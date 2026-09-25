package engine_test

import (
	"context"
	"testing"
	"time"

	"github.com/mt-hack-predictor/backend/internal/engine"
	"github.com/mt-hack-predictor/backend/internal/fleet"
	"github.com/mt-hack-predictor/backend/internal/models"
	"github.com/mt-hack-predictor/backend/internal/ndtp"
	"github.com/mt-hack-predictor/backend/internal/schedule"
	"github.com/mt-hack-predictor/backend/internal/telemetry"
)

func TestEndToEndTelemetryToHoldingFlow(t *testing.T) {
	fleetMgr := fleet.NewManager()
	tracker := telemetry.NewTracker(15 * time.Minute)
	matcher := schedule.NewMatcher()
	headwayCalc := engine.NewHeadwayCalculator(480.0)
	alertMgr := engine.NewAlertManager()

	now := time.Now()

	// 1. Setup schedule stop
	matcher.AddStop(schedule.Stop{
		ID:        "stop_target_1",
		TrID:      "1166336",
		TimeBegin: now.Add(12 * time.Minute), // in 10-15m window
		Latitude:  55.7550,
		Longitude: 37.6150,
		Address:   "ул. Тверская, д.1",
	})

	// 2. Simulate 2 consecutive NDTP packets (Bus 1 ahead, Bus 2 behind approaching rapidly)
	aheadNav := ndtp.NavCell{
		UnitID:    1166335,
		Timestamp: now,
		Latitude:  55.7548,
		Longitude: 37.6148,
		SpeedKmh:  15.0,
		Course:    180.0,
	}
	behindNav := ndtp.NavCell{
		UnitID:    1166336,
		Timestamp: now,
		Latitude:  55.7549, // only ~15m behind!
		Longitude: 37.6149,
		SpeedKmh:  25.0,
		Course:    180.0,
	}

	fleetMgr.UpsertNav(aheadNav)
	vBehind := fleetMgr.UpsertNav(behindNav)

	// Track telemetry
	tracker.AddPoint(vBehind.ID, telemetry.Point{
		Timestamp: vBehind.Timestamp,
		Latitude:  vBehind.Latitude,
		Longitude: vBehind.Longitude,
		SpeedKmh:  vBehind.SpeedKmH,
		Bearing:   vBehind.Bearing,
	})

	// Match schedule
	match := matcher.MatchVehicle(vBehind.ID, vBehind.Latitude, vBehind.Longitude, vBehind.Timestamp)
	if !match.Matched || match.StopID != "stop_target_1" {
		t.Fatalf("expected schedule match to stop_target_1, got %+v", match)
	}
	fleetMgr.UpdateStopInfo(vBehind.ID, match.StopID, match.StopName, match.CurDevSeconds)

	// Calculate headway
	allVehicles := fleetMgr.List()
	headwayMap := headwayCalc.AssessFleetHeadways(allVehicles)
	hwInfo, ok := headwayMap[vBehind.ID]
	if !ok {
		t.Fatalf("expected headway info for %s", vBehind.ID)
	}

	if hwInfo.BunchingRisk < 0.70 {
		t.Fatalf("expected high bunching risk, got %v", hwInfo.BunchingRisk)
	}

	// Generate DSS Alert
	vBehind.DelaySeconds = 140.0
	alert := alertMgr.UpsertVehicleAlert(
		*vBehind,
		hwInfo,
		[]models.SHAPFactor{
			{Feature: "speed_last_3m", Title: "Затор", Weight: 60.0, ImpactScore: 80.0},
		},
		match.HorizonSeconds,
	)

	if alert == nil {
		t.Fatalf("expected DSS alert to be generated")
	}
	if alert.Recommendation == nil || alert.Recommendation.ActionType != "HOLDING" {
		t.Fatalf("expected HOLDING recommendation, got %+v", alert.Recommendation)
	}

	// Apply Holding Recommendation
	targetVeh, holdSec, applied := alertMgr.ApplyRecommendation(alert.ID)
	if !applied || targetVeh != vBehind.ID {
		t.Fatalf("expected holding applied to %s, got applied=%v, target=%s", vBehind.ID, applied, targetVeh)
	}
	fleetMgr.ApplyHolding(targetVeh, holdSec)

	// Verify vehicle is now REGULATING
	vReg, _ := fleetMgr.Get(targetVeh)
	if vReg.Status != "REGULATING" {
		t.Errorf("expected vehicle status REGULATING, got %s", vReg.Status)
	}
	if alertMgr.PreventedCount() != 1 {
		t.Errorf("expected 1 prevented incident, got %d", alertMgr.PreventedCount())
	}
	_ = context.Background()
}
