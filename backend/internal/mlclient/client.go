package mlclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/mt-hack-predictor/backend/internal/models"
)

const (
	defaultTimeout  = 100 * time.Millisecond
	defaultDebounce = 10 * time.Second
)

// PredictRequest is the legacy/Go payload accepted by ML /predict.
type PredictRequest struct {
	VehicleID                 string  `json:"vehicle_id"`
	RouteID                   string  `json:"route_id,omitempty"`
	CurrentDelaySec           float64 `json:"current_delay_sec"`
	CurrentHeadwaySec         float64 `json:"current_headway_sec,omitempty"`
	HistoricalAvgSpeed        float64 `json:"historical_avg_speed,omitempty"`
	CumulativeDelayPrevStops  float64 `json:"cumulative_delay_prev_stops,omitempty"`
	WeatherFactor             float64 `json:"weather_factor,omitempty"`
	HourOfDay                 int     `json:"hour_of_day"`
	DayOfWeek                 int     `json:"day_of_week"`
	SpeedKmh                  float64 `json:"speed_kmh,omitempty"`
	Heading                   float64 `json:"heading,omitempty"`
	Latitude                  float64 `json:"latitude,omitempty"`
	Longitude                 float64 `json:"longitude,omitempty"`
	LocationValid             bool    `json:"location_valid,omitempty"`
	CurDevS                   float64 `json:"cur_dev_s,omitempty"`
	TrID                      string  `json:"tr_id,omitempty"`
}

// SHAPFactor mirrors ML response factors.
type SHAPFactor struct {
	Feature     string  `json:"feature"`
	Title       string  `json:"title"`
	Weight      float64 `json:"weight"`
	ImpactScore float64 `json:"impact_score"`
}

// PredictResponse is the ML /predict JSON body (subset we need).
type PredictResponse struct {
	SampleID                 string       `json:"sample_id"`
	VehicleID                string       `json:"vehicle_id"`
	TrID                     string       `json:"tr_id"`
	PredictedDelaySec        float64      `json:"predicted_delay_sec"`
	PredictedClass           string       `json:"predicted_class"`
	HorizonSec               float64      `json:"horizon_sec"`
	BunchingRiskProbability  float64      `json:"bunching_risk_probability"`
	IncidentPredictedInMin   float64      `json:"incident_predicted_in_min"`
	Severity                 string       `json:"severity"`
	Factors                  []SHAPFactor `json:"factors"`
	RecommendationHoldSec    int          `json:"recommendation_hold_sec"`
	Fallback                 bool         `json:"fallback,omitempty"`
	Error                    string       `json:"error,omitempty"`
}

// Client calls the FastAPI ML service with debounce and graceful degradation.
type Client struct {
	baseURL  string
	http     *http.Client
	debounce time.Duration

	mu       sync.Mutex
	lastCall map[string]time.Time
	lastPred map[string]PredictResponse

	// Metrics
	okCount       uint64
	fallbackCount uint64
}

// New creates an ML HTTP client. baseURL example: http://ml:8000 or http://localhost:8000.
func New(baseURL string) *Client {
	if baseURL == "" {
		baseURL = "http://localhost:8000"
	}
	return &Client{
		baseURL: baseURL,
		http: &http.Client{
			Timeout: defaultTimeout,
			Transport: &http.Transport{
				MaxIdleConns:        32,
				MaxIdleConnsPerHost: 16,
				IdleConnTimeout:     90 * time.Second,
			},
		},
		debounce: defaultDebounce,
		lastCall: make(map[string]time.Time),
		lastPred: make(map[string]PredictResponse),
	}
}

// PredictForVehicle builds a request from a live vehicle and runs Predict.
func (c *Client) PredictForVehicle(ctx context.Context, v models.Vehicle) PredictResponse {
	now := v.Timestamp
	if now.IsZero() {
		now = time.Now()
	}
	// Go weekday: Sunday=0 … Saturday=6; ML schema uses Monday=0 … Sunday=6.
	dow := int(now.Weekday()) - 1
	if dow < 0 {
		dow = 6
	}
	req := PredictRequest{
		VehicleID:          v.ID,
		TrID:               v.ID,
		RouteID:            v.RouteID,
		CurrentDelaySec:    v.DelaySeconds,
		CurDevS:            v.DelaySeconds,
		CurrentHeadwaySec:  v.HeadwaySeconds,
		HistoricalAvgSpeed: v.SpeedKmH,
		SpeedKmh:           v.SpeedKmH,
		Heading:            v.Bearing,
		Latitude:           v.Latitude,
		Longitude:          v.Longitude,
		LocationValid:      true,
		WeatherFactor:      1.0,
		HourOfDay:          now.Hour(),
		DayOfWeek:          dow,
	}
	return c.Predict(ctx, req)
}

// PredictEnriched builds a prediction request with externally computed schedule deviation, rolling speed, and headway.
func (c *Client) PredictEnriched(
	ctx context.Context,
	v models.Vehicle,
	curDevSec float64,
	avgSpeed float64,
	headwaySec float64,
) PredictResponse {
	now := v.Timestamp
	if now.IsZero() {
		now = time.Now()
	}
	dow := int(now.Weekday()) - 1
	if dow < 0 {
		dow = 6
	}
	if headwaySec <= 0 {
		headwaySec = 480.0
	}
	if avgSpeed <= 0 {
		avgSpeed = v.SpeedKmH
	}
	req := PredictRequest{
		VehicleID:          v.ID,
		TrID:               v.ID,
		RouteID:            v.RouteID,
		CurrentDelaySec:    curDevSec,
		CurDevS:            curDevSec,
		CurrentHeadwaySec:  headwaySec,
		HistoricalAvgSpeed: avgSpeed,
		SpeedKmh:           v.SpeedKmH,
		Heading:            v.Bearing,
		Latitude:           v.Latitude,
		Longitude:          v.Longitude,
		LocationValid:      true,
		WeatherFactor:      1.0,
		HourOfDay:          now.Hour(),
		DayOfWeek:          dow,
	}
	return c.Predict(ctx, req)
}

// Predict posts to /predict. On timeout/error returns persistence fallback (cur_dev_s).
// Debounces to at most one live ML call per vehicle per debounce window;
// within the window returns the cached prediction (or fallback if none yet).
func (c *Client) Predict(ctx context.Context, req PredictRequest) PredictResponse {
	id := req.VehicleID
	if id == "" {
		id = req.TrID
	}

	c.mu.Lock()
	last, seen := c.lastCall[id]
	cached, hasCache := c.lastPred[id]
	within := seen && time.Since(last) < c.debounce
	c.mu.Unlock()

	if within {
		if hasCache {
			return cached
		}
		return fallbackFrom(req, "debounced_no_cache")
	}

	resp, err := c.doPredict(ctx, req)
	if err != nil {
		c.fallbackCount++
		fb := fallbackFrom(req, err.Error())
		c.mu.Lock()
		c.lastCall[id] = time.Now()
		c.lastPred[id] = fb
		c.mu.Unlock()
		log.Printf("[ML] fallback vehicle=%s: %v", id, err)
		return fb
	}

	c.okCount++
	c.mu.Lock()
	c.lastCall[id] = time.Now()
	c.lastPred[id] = resp
	c.mu.Unlock()
	return resp
}

func (c *Client) doPredict(ctx context.Context, req PredictRequest) (PredictResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return PredictResponse{}, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/predict", bytes.NewReader(body))
	if err != nil {
		return PredictResponse{}, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")

	res, err := c.http.Do(httpReq)
	if err != nil {
		return PredictResponse{}, err
	}
	defer res.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if err != nil {
		return PredictResponse{}, err
	}
	if res.StatusCode >= 300 {
		return PredictResponse{}, fmt.Errorf("ml status %d: %s", res.StatusCode, truncate(string(raw), 200))
	}

	var out PredictResponse
	if err := json.Unmarshal(raw, &out); err != nil {
		return PredictResponse{}, err
	}
	if out.VehicleID == "" {
		out.VehicleID = req.VehicleID
	}
	if out.TrID == "" {
		out.TrID = req.TrID
	}
	return out, nil
}

// Stats returns success/fallback counters.
func (c *Client) Stats() (ok, fallback uint64) {
	return c.okCount, c.fallbackCount
}

func fallbackFrom(req PredictRequest, reason string) PredictResponse {
	delay := req.CurrentDelaySec
	if req.CurDevS != 0 {
		delay = req.CurDevS
	}
	sev := "LOW"
	switch {
	case delay > 300:
		sev = "CRITICAL"
	case delay > 180:
		sev = "HIGH"
	case delay > 60:
		sev = "MEDIUM"
	}
	cls := "ontime"
	if delay < -60 {
		cls = "early"
	} else if delay > 120 {
		cls = "late"
	}
	return PredictResponse{
		VehicleID:               req.VehicleID,
		TrID:                    req.TrID,
		PredictedDelaySec:       delay,
		PredictedClass:          cls,
		HorizonSec:              750,
		BunchingRiskProbability: 0,
		IncidentPredictedInMin:  12.5,
		Severity:                sev,
		Factors: []SHAPFactor{{
			Feature:     "cur_dev_s",
			Title:       "Эвристика: персистентность текущей задержки (ML недоступен)",
			Weight:      100,
			ImpactScore: delay,
		}},
		Fallback: true,
		Error:    reason,
	}
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

// ToModelsFactors converts ML factors into domain SHAP factors.
func ToModelsFactors(in []SHAPFactor) []models.SHAPFactor {
	out := make([]models.SHAPFactor, len(in))
	for i, f := range in {
		out[i] = models.SHAPFactor{
			Feature:     f.Feature,
			Title:       f.Title,
			Weight:      f.Weight,
			ImpactScore: f.ImpactScore,
		}
	}
	return out
}
