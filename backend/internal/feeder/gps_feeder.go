package feeder

import (
	"context"
	"fmt"
	"math"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/mt-hack-predictor/backend/internal/api"
	"github.com/mt-hack-predictor/backend/internal/engine"
	"github.com/mt-hack-predictor/backend/internal/mlclient"
	"github.com/mt-hack-predictor/backend/internal/models"
	"github.com/mt-hack-predictor/backend/internal/schedule"
)

// GPSFeeder replays historical GPS telemetry from traffic.csv in real-time,
// synchronizing all active tracks according to a shared virtual clock and
// evaluating ML CatBoost predictions and SHAP factor decompositions.
type GPSFeeder struct {
	mu             sync.RWMutex
	tracks         map[int][]api.GPSPoint
	trackIDs       []int
	cursors        map[int]int
	simTime        time.Time
	startTime      time.Time
	endTime        time.Time
	speed          float64
	isPlaying      bool
	schedMatcher   *schedule.Matcher
	headwayCalc    *engine.HeadwayCalculator
	alertMgr       *engine.AlertManager
	mlCli          *mlclient.Client
	predictions    map[string]mlclient.PredictResponse
	activeAlerts   map[string]models.Alert
	holdingUntil   map[string]time.Time
	lastBatchEval  time.Time
	activeVehicles []models.Vehicle
	currentAlert   *models.Alert
	status         models.SystemStatus
}

// NewGPSFeeder creates a feeder from in-memory tracks, defaulting to
// Moscow morning rush hour (2026-01-06 08:00:00 UTC) at 1x simulation speed (real-time).
func NewGPSFeeder(
	tracks map[int][]api.GPSPoint,
	matcher *schedule.Matcher,
	hw *engine.HeadwayCalculator,
	alerts *engine.AlertManager,
	mlCli *mlclient.Client,
) *GPSFeeder {
	trackIDs := make([]int, 0, len(tracks))
	cursors := make(map[int]int, len(tracks))
	for id, pts := range tracks {
		if len(pts) >= 2 {
			trackIDs = append(trackIDs, id)
			cursors[id] = 0
		}
	}
	sort.Ints(trackIDs)

	start := time.Date(2026, 1, 6, 8, 0, 0, 0, time.UTC)
	end := time.Date(2026, 1, 6, 23, 59, 0, 0, time.UTC)

	gf := &GPSFeeder{
		tracks:       tracks,
		trackIDs:     trackIDs,
		cursors:      cursors,
		simTime:      start,
		startTime:    start,
		endTime:      end,
		speed:        1.0, // Default 1x real-time mode
		isPlaying:    true,
		schedMatcher: matcher,
		headwayCalc:  hw,
		alertMgr:     alerts,
		mlCli:        mlCli,
		predictions:  make(map[string]mlclient.PredictResponse),
		activeAlerts: make(map[string]models.Alert),
		holdingUntil: make(map[string]time.Time),
	}

	gf.recomputePositions()
	return gf
}

// SetPlaying sets play/pause state.
func (f *GPSFeeder) SetPlaying(playing bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.isPlaying = playing
}

// IsPlaying returns true if feeder is running.
func (f *GPSFeeder) IsPlaying() bool {
	f.mu.RLock()
	defer f.mu.RUnlock()
	return f.isPlaying
}

// SetSpeed updates time speed multiplier.
func (f *GPSFeeder) SetSpeed(speed float64) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if speed > 0 {
		f.speed = speed
	}
}

// GetSpeed returns current time speed multiplier.
func (f *GPSFeeder) GetSpeed() float64 {
	f.mu.RLock()
	defer f.mu.RUnlock()
	return f.speed
}

// GetSimTime returns current simulation clock.
func (f *GPSFeeder) GetSimTime() time.Time {
	f.mu.RLock()
	defer f.mu.RUnlock()
	return f.simTime
}

// Reset resets simulation clock back to startTime.
func (f *GPSFeeder) Reset() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.simTime = f.startTime
	for id := range f.cursors {
		f.cursors[id] = 0
	}
	f.holdingUntil = make(map[string]time.Time)
	f.predictions = make(map[string]mlclient.PredictResponse)
	f.activeAlerts = make(map[string]models.Alert)
	f.recomputePositions()
}

// ApplyHolding activates a temporary holding regulation on a vehicle.
func (f *GPSFeeder) ApplyHolding(targetVehicleID string, durationSec int) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if durationSec <= 0 {
		durationSec = 150
	}

	cleanID := strings.TrimPrefix(targetVehicleID, "P")
	normID := "P" + cleanID
	holdExpiry := f.simTime.Add(time.Duration(durationSec) * time.Second)

	f.holdingUntil[normID] = holdExpiry
	f.holdingUntil[cleanID] = holdExpiry

	for k, alert := range f.activeAlerts {
		if alert.VehicleID == normID || alert.VehicleID == cleanID {
			if alert.Recommendation != nil {
				alert.Recommendation.Applied = true
			}
			f.activeAlerts[k] = alert
		}
	}
	if f.currentAlert != nil && (f.currentAlert.VehicleID == normID || f.currentAlert.VehicleID == cleanID) {
		if f.currentAlert.Recommendation != nil {
			f.currentAlert.Recommendation.Applied = true
		}
	}
}

// GetVehicle returns a vehicle copy by ID if active.
func (f *GPSFeeder) GetVehicle(id string) *models.Vehicle {
	f.mu.RLock()
	defer f.mu.RUnlock()
	cleanID := strings.TrimPrefix(id, "P")
	for _, v := range f.activeVehicles {
		if v.ID == id || v.ID == "P"+cleanID || strings.TrimPrefix(v.ID, "P") == cleanID {
			vCopy := v
			return &vCopy
		}
	}
	return nil
}

// GetPrediction returns the cached ML prediction for a vehicle if available.
func (f *GPSFeeder) GetPrediction(id string) (mlclient.PredictResponse, bool) {
	f.mu.RLock()
	defer f.mu.RUnlock()
	cleanID := strings.TrimPrefix(id, "P")
	if p, ok := f.predictions["P"+cleanID]; ok {
		return p, true
	}
	if p, ok := f.predictions[cleanID]; ok {
		return p, true
	}
	return mlclient.PredictResponse{}, false
}

// GetAlerts returns a slice of all active alerts.
func (f *GPSFeeder) GetAlerts() []models.Alert {
	f.mu.RLock()
	defer f.mu.RUnlock()
	res := make([]models.Alert, 0, len(f.activeAlerts))
	for _, a := range f.activeAlerts {
		res = append(res, a)
	}
	return res
}

// AdvanceTick advances the simulation clock by dt * speed and updates all active vehicles.
func (f *GPSFeeder) AdvanceTick(dt time.Duration) {
	f.mu.Lock()
	defer f.mu.Unlock()

	if !f.isPlaying {
		return
	}

	simDelta := time.Duration(float64(dt) * f.speed)
	f.simTime = f.simTime.Add(simDelta)

	if f.simTime.After(f.endTime) {
		f.simTime = f.startTime
		for id := range f.cursors {
			f.cursors[id] = 0
		}
	}

	f.recomputePositions()
}

// recomputePositions calculates vehicle positions for the current simTime (must be called with f.mu held).
func (f *GPSFeeder) recomputePositions() {
	active := make([]models.Vehicle, 0, len(f.trackIDs))

	for _, trID := range f.trackIDs {
		pts := f.tracks[trID]
		if len(pts) < 2 {
			continue
		}

		// Skip if bus has not started service yet or already completed its day
		if f.simTime.Before(pts[0].EventTime) || f.simTime.After(pts[len(pts)-1].EventTime) {
			continue
		}

		cursor := f.cursors[trID]
		if cursor >= len(pts)-1 || f.simTime.Before(pts[cursor].EventTime) {
			cursor = 0
		}

		// Advance cursor forward
		for cursor+1 < len(pts) && pts[cursor+1].EventTime.Before(f.simTime) {
			cursor++
		}
		f.cursors[trID] = cursor

		if cursor+1 >= len(pts) {
			continue
		}

		p1 := pts[cursor]
		p2 := pts[cursor+1]

		span := p2.EventTime.Sub(p1.EventTime).Seconds()
		// If telemetry gap is longer than 10 minutes and more than 3 minutes have passed since p1, skip (depot/parked)
		if span > 600 && f.simTime.Sub(p1.EventTime).Seconds() > 180 {
			continue
		}

		alpha := 0.0
		if span > 0 {
			alpha = f.simTime.Sub(p1.EventTime).Seconds() / span
			if alpha < 0 {
				alpha = 0
			} else if alpha > 1 {
				alpha = 1
			}
		}

		lat := p1.Lat + alpha*(p2.Lat-p1.Lat)
		lon := p1.Lon + alpha*(p2.Lon-p1.Lon)
		speed := p1.Speed + alpha*(p2.Speed-p1.Speed)

		heading := p1.Heading
		if (p1.Heading == 0 || math.IsNaN(p1.Heading)) && speed > 2.0 {
			heading = calculateBearing(p1.Lat, p1.Lon, p2.Lat, p2.Lon)
		}

		vehID := fmt.Sprintf("P%d", trID)
		routeID := fmt.Sprintf("%d", trID)

		status := "ON_TIME"
		delaySec := 0.0
		nextStopID := "GPS-STOP"
		nextStopName := "По маршруту"

		// Schedule matching
		if f.schedMatcher != nil {
			match := f.schedMatcher.MatchVehicle(fmt.Sprintf("%d", trID), lat, lon, f.simTime)
			if match.Matched {
				nextStopID = match.StopID
				nextStopName = match.StopName
				delaySec = match.CurDevSeconds
				if match.CurDevSeconds > 180 {
					status = "DELAYED"
				} else if match.CurDevSeconds < -60 {
					status = "EARLY"
				}
			}
		}

		// Check active holding regulation
		if holdExp, hasHold := f.holdingUntil[vehID]; hasHold {
			if f.simTime.Before(holdExp) {
				speed = 0.0
				status = "REGULATING"
			} else {
				delete(f.holdingUntil, vehID)
				delete(f.holdingUntil, strings.TrimPrefix(vehID, "P"))
			}
		}

		active = append(active, models.Vehicle{
			ID:             vehID,
			RouteID:        routeID,
			Latitude:       lat,
			Longitude:      lon,
			Bearing:        heading,
			SpeedKmH:       math.Round(speed*10) / 10,
			DelaySeconds:   math.Round(delaySec),
			NextStopID:     nextStopID,
			NextStopName:   nextStopName,
			Timestamp:      f.simTime,
			Status:         status,
			HeadwaySeconds: 480.0,
		})
	}

	// Assess headways
	if f.headwayCalc != nil && len(active) > 0 {
		hwMap := f.headwayCalc.AssessFleetHeadways(active)
		for i := range active {
			if info, ok := hwMap[active[i].ID]; ok {
				active[i].HeadwaySeconds = info.HeadwaySec
				if info.BunchingRisk >= 0.7 && active[i].Status != "REGULATING" {
					active[i].Status = "BUNCHING_RISK"
				}
			}
		}
	}

	// Periodic batched CatBoost ML inference via POST /predict/batch (processes all vehicles in 1 HTTP call)
	if f.mlCli != nil && len(active) > 0 && time.Since(f.lastBatchEval) >= 2*time.Second {
		f.lastBatchEval = time.Now()
		reqs := make([]mlclient.PredictRequest, len(active))
		now := f.simTime
		dow := int(now.Weekday()) - 1
		if dow < 0 {
			dow = 6
		}
		for i, v := range active {
			reqs[i] = mlclient.PredictRequest{
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
				TargetStopID:       v.NextStopID,
				NextStopID:         v.NextStopID,
				NextStopName:       v.NextStopName,
			}
		}
		activeSnapshot := make([]models.Vehicle, len(active))
		copy(activeSnapshot, active)
		go f.runBatchPrediction(reqs, activeSnapshot)
	}

	// Apply cached ML predictions to vehicle status
	for i := range active {
		vID := active[i].ID
		if pred, hasPred := f.predictions[vID]; hasPred && active[i].Status != "REGULATING" {
			if pred.BunchingRiskProbability >= 0.65 {
				active[i].Status = "BUNCHING_RISK"
			} else if pred.PredictedDelaySec >= 180 {
				active[i].Status = "DELAYED"
			}
		}
	}

	f.activeVehicles = active

	// Select primary alert from activeAlerts for WS broadcast
	var primaryAlert *models.Alert
	var maxScore float64 = -1.0
	for _, a := range f.activeAlerts {
		score := a.Probability
		if a.Severity == models.SeverityCritical {
			score += 1.0
		}
		if a.Recommendation != nil && a.Recommendation.Applied {
			score -= 0.5
		}
		if score > maxScore {
			maxScore = score
			aCopy := a
			primaryAlert = &aCopy
		}
	}
	f.currentAlert = primaryAlert

	// Compute status metrics
	onTimeCount := 0
	for _, v := range active {
		if v.Status == "ON_TIME" || v.Status == "REGULATING" {
			onTimeCount++
		}
	}
	punctuality := 100.0
	if len(active) > 0 {
		punctuality = (float64(onTimeCount) / float64(len(active))) * 100.0
	}

	f.status = models.SystemStatus{
		LiveSimulationActive: f.isPlaying,
		ActiveVehiclesCount:  len(active),
		ActiveAlertsCount:    len(f.activeAlerts),
		PunctualityRate:      math.Round(punctuality*10) / 10,
		SimulationSpeed:      f.speed,
	}
}

// evaluateMLPrediction calls the FastAPI ML CatBoost predictor in the background.
func (f *GPSFeeder) evaluateMLPrediction(v models.Vehicle, curDev float64, hwSec float64) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	pred := f.mlCli.PredictEnriched(ctx, v, curDev, v.SpeedKmH, hwSec)
	f.storePrediction(v.ID, pred, v)
}

// runBatchPrediction executes batched ML CatBoost inference for multiple vehicles in 1 HTTP call.
func (f *GPSFeeder) runBatchPrediction(reqs []mlclient.PredictRequest, vehicles []models.Vehicle) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	preds, err := f.mlCli.PredictBatch(ctx, reqs)
	if err != nil && len(preds) == 0 {
		return
	}

	f.mu.Lock()
	defer f.mu.Unlock()

	vehMap := make(map[string]models.Vehicle, len(vehicles))
	for _, v := range vehicles {
		vehMap[v.ID] = v
	}

	for _, pred := range preds {
		vehID := pred.VehicleID
		v, exists := vehMap[vehID]
		if !exists {
			continue
		}
		f.predictions[vehID] = pred

		if pred.BunchingRiskProbability >= 0.65 || pred.PredictedDelaySec >= 180 {
			alertType := "SEVERE_DELAY"
			cleanID := strings.TrimPrefix(vehID, "P")
			msg := fmt.Sprintf("Задержка графика борта №%s (+%.0f мин)", cleanID, pred.PredictedDelaySec/60)
			if pred.BunchingRiskProbability >= 0.65 {
				alertType = "BUS_BUNCHING"
				msg = fmt.Sprintf("Риск пачкования борта №%s (интервал %.1f мин)", cleanID, v.HeadwaySeconds/60)
			}

			holdDuration := pred.RecommendationHoldSec
			if holdDuration <= 0 {
				holdDuration = 120
			}

			isApplied := false
			if exp, hasHold := f.holdingUntil[vehID]; hasHold && f.simTime.Before(exp) {
				isApplied = true
			}

			f.activeAlerts[vehID] = models.Alert{
				ID:          fmt.Sprintf("alert_gps_%s", cleanID),
				VehicleID:   vehID,
				RouteID:     v.RouteID,
				Type:        alertType,
				Severity:    models.Severity(pred.Severity),
				Probability: pred.BunchingRiskProbability,
				Message:     msg,
				Factors:     mlclient.ToModelsFactors(pred.Factors),
				Recommendation: &models.Recommendation{
					ActionType:      "HOLDING",
					TargetVehicleID: vehID,
					HoldStopName:    v.NextStopName,
					DurationSeconds: holdDuration,
					PredictedImpact: fmt.Sprintf("Выравнивание интервала движения (эффект SHAP %d%%)", int(math.Round(pred.BunchingRiskProbability*100))),
					Applied:         isApplied,
				},
				CreatedAt: f.simTime,
			}
		} else {
			if exp, hasHold := f.holdingUntil[vehID]; !hasHold || !f.simTime.Before(exp) {
				delete(f.activeAlerts, vehID)
			}
		}
	}
}

// storePrediction saves prediction and updates alert state.
func (f *GPSFeeder) storePrediction(vehID string, pred mlclient.PredictResponse, v models.Vehicle) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.predictions[vehID] = pred

	// If bunching risk or severe delay, create or update Alert
	if pred.BunchingRiskProbability >= 0.65 || pred.PredictedDelaySec >= 180 {
		alertType := "SEVERE_DELAY"
		cleanID := strings.TrimPrefix(vehID, "P")
		msg := fmt.Sprintf("Задержка графика борта №%s (+%.0f мин)", cleanID, pred.PredictedDelaySec/60)
		if pred.BunchingRiskProbability >= 0.65 {
			alertType = "BUS_BUNCHING"
			msg = fmt.Sprintf("Риск пачкования борта №%s (интервал %.1f мин)", cleanID, v.HeadwaySeconds/60)
		}

		holdDuration := pred.RecommendationHoldSec
		if holdDuration <= 0 {
			holdDuration = 120
		}

		// Check if holding is already applied
		isApplied := false
		if exp, hasHold := f.holdingUntil[vehID]; hasHold && f.simTime.Before(exp) {
			isApplied = true
		}

		f.activeAlerts[vehID] = models.Alert{
			ID:          fmt.Sprintf("alert_gps_%s", cleanID),
			VehicleID:   vehID,
			RouteID:     v.RouteID,
			Type:        alertType,
			Severity:    models.Severity(pred.Severity),
			Probability: pred.BunchingRiskProbability,
			Message:     msg,
			Factors:     mlclient.ToModelsFactors(pred.Factors),
			Recommendation: &models.Recommendation{
				ActionType:      "HOLDING",
				TargetVehicleID: vehID,
				HoldStopName:    v.NextStopName,
				DurationSeconds: holdDuration,
				PredictedImpact: fmt.Sprintf("Выравнивание интервала движения (эффект SHAP %d%%)", int(math.Round(pred.BunchingRiskProbability*100))),
				Applied:         isApplied,
			},
			CreatedAt: f.simTime,
		}
	} else {
		// If condition cleared and not currently holding, remove alert
		if exp, hasHold := f.holdingUntil[vehID]; !hasHold || !f.simTime.Before(exp) {
			delete(f.activeAlerts, vehID)
		}
	}
}

// GetState returns current vehicles, alert, and system status snapshot.
func (f *GPSFeeder) GetState() ([]models.Vehicle, *models.Alert, models.SystemStatus) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	vehicles := make([]models.Vehicle, len(f.activeVehicles))
	copy(vehicles, f.activeVehicles)

	var alert *models.Alert
	if f.currentAlert != nil {
		alertCopy := *f.currentAlert
		alert = &alertCopy
	}

	return vehicles, alert, f.status
}

func calculateBearing(lat1, lon1, lat2, lon2 float64) float64 {
	rad := math.Pi / 180.0
	dLon := (lon2 - lon1) * rad
	y := math.Sin(dLon) * math.Cos(lat2*rad)
	x := math.Cos(lat1*rad)*math.Sin(lat2*rad) - math.Sin(lat1*rad)*math.Cos(lat2*rad)*math.Cos(dLon)
	bearing := math.Atan2(y, x) * 180.0 / math.Pi
	return math.Mod(bearing+360.0, 360.0)
}
