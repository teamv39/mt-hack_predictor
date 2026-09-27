package fleet

import (
	"testing"
	"time"

	"github.com/mt-hack-predictor/backend/internal/models"
	"github.com/mt-hack-predictor/backend/internal/ndtp"
)

func TestFleetManager_UpsertAndMerge(t *testing.T) {
	mgr := NewManager()

	nav := ndtp.NavCell{
		UnitID:    999,
		Latitude:  55.75,
		Longitude: 37.61,
		Course:    90,
		SpeedKmh:  30,
		Timestamp: time.Now().UTC(),
		Valid:     true,
	}

	v := mgr.UpsertNav(nav)
	if v.ID != "999" {
		t.Fatalf("expected vehicle ID '999', got %s", v.ID)
	}
	if v.Latitude != 55.75 {
		t.Fatalf("expected lat 55.75, got %.2f", v.Latitude)
	}

	if mgr.Count() != 1 {
		t.Fatalf("expected count 1, got %d", mgr.Count())
	}

	// Update with ML prediction
	mgr.SetPrediction("999", 240, 0.85, 45)
	updated, ok := mgr.Get("999")
	if !ok {
		t.Fatal("expected vehicle 999 to exist")
	}
	if updated.Status != "BUNCHING_RISK" {
		t.Fatalf("expected status BUNCHING_RISK, got %s", updated.Status)
	}
	if updated.DelaySeconds != 240 {
		t.Fatalf("expected delay 240, got %.0f", updated.DelaySeconds)
	}

	// Test MergeDemo with existing demo vehicles
	demo := []models.Vehicle{
		{ID: "demo-1", RouteID: "m3", Status: "ON_TIME"},
		{ID: "999", RouteID: "demo-override", Status: "ON_TIME"}, // Should NOT duplicate
	}

	merged := mgr.MergeDemo(demo)
	if len(merged) != 2 {
		t.Fatalf("expected 2 merged vehicles, got %d", len(merged))
	}
}
