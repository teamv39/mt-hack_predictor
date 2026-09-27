package engine

import (
	"testing"

	"github.com/mt-hack-predictor/backend/internal/models"
)

func TestComputeWeldingWaitTime(t *testing.T) {
	// 1. Uniform headways (all 480 sec = 8 min) -> E[W] should be exactly 4.0 min
	uniform := []float64{480.0, 480.0, 480.0, 480.0}
	ewUniform := ComputeWeldingWaitTime(uniform)
	if ewUniform != 4.0 {
		t.Errorf("expected 4.0 min for uniform headways, got %v", ewUniform)
	}

	// 2. Bunched headways (one 60 sec = 1 min, one 900 sec = 15 min, mean 480 sec = 8 min)
	// Var(H) is huge -> E[W] should be significantly higher than 4.0 min
	bunched := []float64{60.0, 900.0}
	ewBunched := ComputeWeldingWaitTime(bunched)
	if ewBunched <= 4.0 {
		t.Errorf("expected bunched wait time > 4.0 min, got %v", ewBunched)
	}
	if ewBunched < 6.0 {
		t.Errorf("expected bunched wait time ~7 min, got %v", ewBunched)
	}
}

func TestSimulateWhatIfHolding(t *testing.T) {
	v1 := models.Vehicle{ID: "bus_1", RouteID: "m3", HeadwaySeconds: 90.0}
	v2 := models.Vehicle{ID: "bus_2", RouteID: "m3", HeadwaySeconds: 870.0}

	req := WhatIfRequest{
		Action:          "HOLDING",
		RouteID:         "m3",
		TargetVehicleID: "bus_1",
		HoldSeconds:     150,
		DailyPassengers: 30000,
	}

	res := SimulateWhatIf(req, []models.Vehicle{v1, v2})

	if res.WaitTimeReductionPct <= 0 {
		t.Errorf("expected positive wait time reduction, got %v", res.WaitTimeReductionPct)
	}
	if res.EconomicBenefitRub <= 0 {
		t.Errorf("expected positive economic benefit, got %v", res.EconomicBenefitRub)
	}
	if res.SimulatedWaitTimeMin >= res.BaselineWaitTimeMin {
		t.Errorf("simulated wait time %v should be less than baseline %v", res.SimulatedWaitTimeMin, res.BaselineWaitTimeMin)
	}
}

func TestSimulateWhatIfDispatchReserve(t *testing.T) {
	v1 := models.Vehicle{ID: "bus_1", RouteID: "m3", HeadwaySeconds: 1500.0} // 25 min gap
	v2 := models.Vehicle{ID: "bus_2", RouteID: "m3", HeadwaySeconds: 480.0}

	req := WhatIfRequest{
		Action:          "DISPATCH_RESERVE",
		RouteID:         "m3",
		DailyPassengers: 25000,
	}

	res := SimulateWhatIf(req, []models.Vehicle{v1, v2})

	if res.WaitTimeReductionPct <= 0 {
		t.Errorf("expected wait time reduction from reserve vehicle, got %v", res.WaitTimeReductionPct)
	}
	if len(res.HeadwaysAfterSec) <= len(res.HeadwaysBeforeSec) {
		t.Errorf("expected additional vehicle headway in after state")
	}
}

func TestSimulateWhatIfHolding_SpecificTargetVehicle(t *testing.T) {
	v1 := models.Vehicle{ID: "bus_1", RouteID: "m3", HeadwaySeconds: 120.0}
	v2 := models.Vehicle{ID: "bus_2", RouteID: "m3", HeadwaySeconds: 400.0}

	req := WhatIfRequest{
		Action:          "HOLDING",
		RouteID:         "m3",
		TargetVehicleID: "bus_2",
		HoldSeconds:     100,
	}

	res := SimulateWhatIf(req, []models.Vehicle{v1, v2})

	// bus_2 is at index 1, its headway should be increased by 100
	if len(res.HeadwaysAfterSec) != 2 {
		t.Fatalf("expected 2 headways, got %d", len(res.HeadwaysAfterSec))
	}
	if res.HeadwaysAfterSec[1] != 500.0 {
		t.Errorf("expected bus_2 headway to be 500.0, got %v", res.HeadwaysAfterSec[1])
	}
}

