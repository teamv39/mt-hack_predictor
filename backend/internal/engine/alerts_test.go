package engine

import (
	"testing"
	"time"

	"github.com/mt-hack-predictor/backend/internal/models"
)

func TestAlertManagerLifecycle(t *testing.T) {
	am := NewAlertManager()

	veh := models.Vehicle{
		ID:           "unit_1043",
		RouteID:      "m3",
		NextStopID:   "stop_baumanskaya",
		NextStopName: "Метро Бауманская",
		DelaySeconds: 140.0,
	}

	hw := HeadwayInfo{
		VehicleID:          "unit_1043",
		AheadVehicleID:     "unit_1042",
		HeadwaySec:         90.0,
		PlanHeadwaySec:     480.0,
		HeadwayRatio:       0.18,
		BunchingRisk:       0.85,
		RecommendedHoldSec: 150,
	}

	factors := []models.SHAPFactor{
		{Feature: "speed_last_3m", Title: "Затор на перегоне", Weight: 60.0, ImpactScore: 85.0},
		{Feature: "cur_dev_s", Title: "Накопленное отставание", Weight: 40.0, ImpactScore: 40.0},
	}

	// 1. Alert created on critical bunching
	alert := am.UpsertVehicleAlert(veh, hw, factors, 750.0)
	if alert == nil {
		t.Fatalf("expected alert to be created")
	}
	if alert.Severity != models.SeverityCritical {
		t.Errorf("expected CRITICAL, got %s", alert.Severity)
	}
	if alert.Recommendation == nil {
		t.Fatalf("expected recommendation to be attached")
	}
	if alert.Recommendation.DurationSeconds != 150 {
		t.Errorf("expected 150s hold, got %d", alert.Recommendation.DurationSeconds)
	}

	// 2. Alert in list
	alerts := am.GetAll()
	if len(alerts) != 1 {
		t.Fatalf("expected 1 active alert, got %d", len(alerts))
	}

	// 3. Apply recommendation
	targetVeh, holdSec, ok := am.ApplyRecommendation(alert.ID)
	if !ok || targetVeh != "unit_1043" || holdSec != 150 {
		t.Fatalf("expected ApplyRecommendation success, got ok=%v, veh=%s, hold=%d", ok, targetVeh, holdSec)
	}

	// 4. Incident count incremented
	if am.PreventedCount() != 1 {
		t.Errorf("expected prevented count 1, got %d", am.PreventedCount())
	}

	// 5. Alert dismissed from active list
	if len(am.GetAll()) != 0 {
		t.Errorf("expected 0 active alerts after apply, got %d", len(am.GetAll()))
	}

	// 6. Holding active
	if !am.IsHoldingActive("unit_1043") {
		t.Errorf("expected holding active for unit_1043")
	}

	// 7. Upserting while holding is active will not re-raise alert
	reAlert := am.UpsertVehicleAlert(veh, hw, factors, 750.0)
	if reAlert != nil {
		t.Errorf("expected no alert while holding is active")
	}
	_ = time.Second
}
