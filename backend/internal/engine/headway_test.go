package engine

import (
	"testing"

	"github.com/mt-hack-predictor/backend/internal/models"
)

func TestHeadwayCalculator(t *testing.T) {
	calc := NewHeadwayCalculator(480.0) // 8 min plan

	// 2 buses very close (100 meters, speed 20 km/h -> ~18s headway -> severe bunching)
	v1 := models.Vehicle{
		ID:        "bus_1",
		RouteID:   "m3",
		Latitude:  55.7500,
		Longitude: 37.6000,
		SpeedKmH:  20.0,
	}
	v2 := models.Vehicle{
		ID:        "bus_2",
		RouteID:   "m3",
		Latitude:  55.7505, // ~60m north
		Longitude: 37.6000,
		SpeedKmH:  20.0,
	}

	res := calc.AssessFleetHeadways([]models.Vehicle{v1, v2})

	info1, ok1 := res["bus_1"]
	if !ok1 {
		t.Fatalf("expected result for bus_1")
	}

	if info1.HeadwayRatio >= 0.35 {
		t.Errorf("expected bunching ratio < 0.35, got %v", info1.HeadwayRatio)
	}
	if info1.BunchingRisk < 0.70 {
		t.Errorf("expected high bunching risk >= 0.70, got %v", info1.BunchingRisk)
	}
	if info1.Status != "BUNCHING_RISK" {
		t.Errorf("expected status BUNCHING_RISK, got %s", info1.Status)
	}
	if info1.RecommendedHoldSec < 60 {
		t.Errorf("expected holding recommendation >= 60s, got %v", info1.RecommendedHoldSec)
	}
}
