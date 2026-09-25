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

// PredictRequest is the payload accepted by ML /predict, containing both
// official competition fields and DSS operational telemetry.
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

	// Extended telemetry features (from tracker.go)
	AvgSpeedWindowKmh         float64 `json:"avg_speed_window_kmh,omitempty"`
	SpeedMean5m               float64 `json:"speed_mean_5m,omitempty"`
	SpeedMean10m              float64 `json:"speed_mean_10m,omitempty"`
	AvgSpeed5m                float64 `json:"avg_speed_5m,omitempty"`
	AvgSpeed10m               float64 `json:"avg_speed_10m,omitempty"`
	IdleTime5m                float64 `json:"idle_time_5m,omitempty"`
	StopRatio5m               float64 `json:"stop_ratio_5m,omitempty"`
	StopRatioWindow           float64 `json:"stop_ratio_window,omitempty"`
	SpeedTrend                float64 `json:"speed_trend,omitempty"`
	TelemetryAgeS             float64 `json:"telemetry_age_s,omitempty"`
	PointsCount5m             int     `json:"points_count_5m,omitempty"`

	// Extended schedule & route progress features (from matcher.go)
	DistanceMeters            float64 `json:"distance_meters,omitempty"`
	DistToTargetM             float64 `json:"dist_to_target_m,omitempty"`
	HorizonSec                float64 `json:"horizon_sec,omitempty"`
	HorizonSeconds            float64 `json:"horizon_seconds,omitempty"`
	TargetStopID              string  `json:"target_stop_id,omitempty"`
	NextStopID                string  `json:"next_stop_id,omitempty"`
	NextStopName              string  `json:"next_stop_name,omitempty"`
	SpeedNeededKmh            float64 `json:"speed_needed_kmh,omitempty"`
}

// EnrichedFeatures carries sliding-window telemetry metrics and schedule matching output for ML inference.
type EnrichedFeatures struct {
	CurDevSec      float64
	AvgSpeed       float64
	HeadwaySec     float64

	// From tracker.go
	AvgSpeed3m    float64
	AvgSpeed5m    float64
	AvgSpeed10m   float64
	IdleTime5m    float64 // Seconds with speed < 2 km/h in last 5m
	StopRatio5m   float64 // Fraction of time idle in last 5m
	SpeedTrend    float64 // avg3m - avg10m
	TelemetryAgeS float64
	PointsCount   int

	// From matcher.go
	DistanceMeters float64 // Haversine distance to target stop
	HorizonSeconds float64 // Horizon to planned arrival
	StopID         string
	StopName       string
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
		AvgSpeedWindowKmh:  v.SpeedKmH,
		SpeedKmh:           v.SpeedKmH,
		Heading:            v.Bearing,
		Latitude:           v.Latitude,
		Longitude:          v.Longitude,
		LocationValid:      true,
		WeatherFactor:      1.0,
		HourOfDay:          now.Hour(),
		DayOfWeek:          dow,
		TargetStopID:       v.NextStopID,
		NextStopID:         v.NextStopID,
		NextStopName:       v.NextStopName,
	}
	return c.Predict(ctx, req)
}

// PredictEnriched builds a prediction request with externally computed schedule deviation, rolling speed, headway,
// and optionally merges extended features (sliding window speed/idle stats from tracker.go and distance/horizon from matcher.go).
func (c *Client) PredictEnriched(
	ctx context.Context,
	v models.Vehicle,
	curDevSec float64,
	avgSpeed float64,
	headwaySec float64,
	extras ...EnrichedFeatures,
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
		AvgSpeedWindowKmh:  avgSpeed,
		SpeedKmh:           v.SpeedKmH,
		Heading:            v.Bearing,
		Latitude:           v.Latitude,
		Longitude:          v.Longitude,
		LocationValid:      true,
		WeatherFactor:      1.0,
		HourOfDay:          now.Hour(),
		DayOfWeek:          dow,
		TargetStopID:       v.NextStopID,
		NextStopID:         v.NextStopID,
		NextStopName:       v.NextStopName,
	}

	if len(extras) > 0 {
		e := extras[0]
		if e.AvgSpeed5m > 0 {
			req.AvgSpeed5m = e.AvgSpeed5m
			req.SpeedMean5m = e.AvgSpeed5m
		}
		if e.AvgSpeed10m > 0 {
			req.AvgSpeed10m = e.AvgSpeed10m
			req.SpeedMean10m = e.AvgSpeed10m
		}
		if e.AvgSpeed3m > 0 {
			req.AvgSpeedWindowKmh = e.AvgSpeed3m
		}
		req.IdleTime5m = e.IdleTime5m
		req.StopRatio5m = e.StopRatio5m
		req.StopRatioWindow = e.StopRatio5m
		req.SpeedTrend = e.SpeedTrend
		if e.TelemetryAgeS > 0 {
			req.TelemetryAgeS = e.TelemetryAgeS
		}
		if e.PointsCount > 0 {
			req.PointsCount5m = e.PointsCount
		}
		if e.DistanceMeters > 0 {
			req.DistanceMeters = e.DistanceMeters
			req.DistToTargetM = e.DistanceMeters
		}
		if e.HorizonSeconds > 0 {
			req.HorizonSeconds = e.HorizonSeconds
			req.HorizonSec = e.HorizonSeconds
		}
		if e.StopID != "" {
			req.TargetStopID = e.StopID
			req.NextStopID = e.StopID
		}
		if e.StopName != "" {
			req.NextStopName = e.StopName
		}
		if req.DistToTargetM > 0 && req.HorizonSec > 10.0 {
			req.SpeedNeededKmh = (req.DistToTargetM / req.HorizonSec) * 3.6
		}
	}

	return c.Predict(ctx, req)
}

// PredictWithEnrichment builds a prediction request directly from EnrichedFeatures.
func (c *Client) PredictWithEnrichment(
	ctx context.Context,
	v models.Vehicle,
	e EnrichedFeatures,
) PredictResponse {
	return c.PredictEnriched(ctx, v, e.CurDevSec, e.AvgSpeed, e.HeadwaySec, e)
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
	horizon := 750.0
	if req.HorizonSec > 0 {
		horizon = req.HorizonSec
	} else if req.HorizonSeconds > 0 {
		horizon = req.HorizonSeconds
	}
	return PredictResponse{
		VehicleID:               req.VehicleID,
		TrID:                    req.TrID,
		PredictedDelaySec:       delay,
		PredictedClass:          cls,
		HorizonSec:              horizon,
		BunchingRiskProbability: 0,
		IncidentPredictedInMin:  horizon / 60.0,
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
