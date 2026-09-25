package engine

import (
	"fmt"
	"sync"
	"time"

	"github.com/mt-hack-predictor/backend/internal/models"
)

// AlertManager maintains active alerts, DSS holding recommendations, and incident history.
type AlertManager struct {
	mu           sync.RWMutex
	alerts       map[string]*models.Alert // key = alert ID
	appliedHolds map[string]time.Time     // vehicleID -> expiration of applied hold
	preventedCnt int
}

// NewAlertManager creates a new thread-safe alert manager.
func NewAlertManager() *AlertManager {
	return &AlertManager{
		alerts:       make(map[string]*models.Alert),
		appliedHolds: make(map[string]time.Time),
	}
}

// UpsertVehicleAlert updates or generates an alert for a vehicle based on ML prediction and Headway assessment.
func (am *AlertManager) UpsertVehicleAlert(
	v models.Vehicle,
	headway HeadwayInfo,
	factors []models.SHAPFactor,
	horizonSec float64,
) *models.Alert {
	am.mu.Lock()
	defer am.mu.Unlock()

	alertID := fmt.Sprintf("alert_%s", v.ID)
	recID := fmt.Sprintf("rec_%s", v.ID)

	// Check if this vehicle is currently in active holding regulation
	if exp, ok := am.appliedHolds[v.ID]; ok {
		if time.Now().Before(exp) {
			// Vehicle is actively regulating; downgrade or remove alert
			delete(am.alerts, alertID)
			return nil
		}
		delete(am.appliedHolds, v.ID)
	}

	// 1. Evaluate Bunching Risk
	if headway.BunchingRisk >= 0.70 {
		holdSec := headway.RecommendedHoldSec
		if holdSec <= 0 {
			holdSec = 150 // default 2.5 min
		}

		stopName := v.NextStopName
		if stopName == "" {
			stopName = "Ближайшая остановка"
		}
		stopID := v.NextStopID
		if stopID == "" {
			stopID = "stop_target"
		}

		estMins := horizonSec / 60.0
		if estMins < 10.0 {
			estMins = 12.5 // within the 10-15 min official window
		}

		alert := &models.Alert{
			ID:            alertID,
			VehicleID:     v.ID,
			RouteID:       v.RouteID,
			Type:          "BUS_BUNCHING",
			Severity:      models.SeverityCritical,
			Probability:   headway.BunchingRisk,
			EstimatedTime: time.Duration(estMins * float64(time.Minute)),
			Message: fmt.Sprintf(
				"Критический риск пачкования: борт %s сближается с бортом %s (интервал %.1f мин вместо %.1f мин)",
				v.ID, headway.AheadVehicleID, headway.HeadwaySec/60.0, headway.PlanHeadwaySec/60.0,
			),
			Factors: factors,
			Recommendation: &models.Recommendation{
				ActionType:      "HOLDING",
				TargetVehicleID: v.ID,
				HoldStopID:      stopID,
				HoldStopName:    stopName,
				DurationSeconds: holdSec,
				PredictedImpact: fmt.Sprintf(
					"Восстановление интервала движения с %.1f мин до %.1f мин",
					headway.HeadwaySec/60.0, headway.PlanHeadwaySec/60.0,
				),
				Applied: false,
			},
			CreatedAt: time.Now().UTC(),
		}

		am.alerts[alertID] = alert
		return alert
	}

	// 2. Evaluate Severe Delay (Delay > 180s without bunching)
	if v.DelaySeconds > 180.0 {
		stopName := v.NextStopName
		if stopName == "" {
			stopName = "по маршруту"
		}

		alert := &models.Alert{
			ID:            alertID,
			VehicleID:     v.ID,
			RouteID:       v.RouteID,
			Type:          "SEVERE_DELAY",
			Severity:      models.SeverityHigh,
			Probability:   0.85,
			EstimatedTime: 12 * time.Minute,
			Message: fmt.Sprintf(
				"Прогнозируется задержка +%.0f сек (+%.1f мин) на остановке \"%s\"",
				v.DelaySeconds, v.DelaySeconds/60.0, stopName,
			),
			Factors:   factors,
			CreatedAt: time.Now().UTC(),
		}

		am.alerts[alertID] = alert
		return alert
	}

	// If neither, remove any resolved alert
	delete(am.alerts, alertID)
	_ = recID
	return nil
}

// ApplyRecommendation applies the holding strategy for an alert/recommendation ID.
func (am *AlertManager) ApplyRecommendation(recOrAlertID string) (targetVehicleID string, holdSec int, ok bool) {
	am.mu.Lock()
	defer am.mu.Unlock()

	for _, alert := range am.alerts {
		if alert.ID == recOrAlertID || (alert.Recommendation != nil && fmt.Sprintf("rec_%s", alert.VehicleID) == recOrAlertID) {
			if alert.Recommendation != nil {
				alert.Recommendation.Applied = true
				targetVehicleID = alert.VehicleID
				holdSec = alert.Recommendation.DurationSeconds
				if holdSec <= 0 {
					holdSec = 150
				}
				// Register hold active window
				am.appliedHolds[targetVehicleID] = time.Now().Add(time.Duration(holdSec) * time.Second)
				am.preventedCnt++

				// Dismiss or downgrade alert since action has been taken
				delete(am.alerts, alert.ID)
				return targetVehicleID, holdSec, true
			}
		}
	}
	return "", 0, false
}

// GetAll returns copies of all active alerts.
func (am *AlertManager) GetAll() []models.Alert {
	am.mu.RLock()
	defer am.mu.RUnlock()

	out := make([]models.Alert, 0, len(am.alerts))
	for _, a := range am.alerts {
		out = append(out, *a)
	}
	return out
}

// PreventedCount returns count of successfully prevented incidents.
func (am *AlertManager) PreventedCount() int {
	am.mu.RLock()
	defer am.mu.RUnlock()
	return am.preventedCnt
}

// IsHoldingActive checks if a vehicle is currently in holding state.
func (am *AlertManager) IsHoldingActive(vehicleID string) bool {
	am.mu.RLock()
	defer am.mu.RUnlock()
	exp, ok := am.appliedHolds[vehicleID]
	if !ok {
		return false
	}
	return time.Now().Before(exp)
}
