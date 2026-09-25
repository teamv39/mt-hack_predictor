package engine

import (
	"testing"

	"github.com/mt-hack-predictor/backend/internal/models"
)

func BenchmarkComputeWeldingWaitTime(b *testing.B) {
	headways := []float64{300, 320, 280, 600, 120, 480, 500, 450}

	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = ComputeWeldingWaitTime(headways)
	}
}

func BenchmarkSimulateWhatIf(b *testing.B) {
	req := WhatIfRequest{
		Action:          "HOLDING",
		RouteID:         "m3",
		TargetVehicleID: "unit-1043",
		HoldSeconds:     150,
		DailyPassengers: 25000,
	}
	vehicles := []models.Vehicle{
		{ID: "unit-1042", RouteID: "m3", HeadwaySeconds: 120},
		{ID: "unit-1043", RouteID: "m3", HeadwaySeconds: 840},
		{ID: "unit-1044", RouteID: "m3", HeadwaySeconds: 480},
		{ID: "unit-1045", RouteID: "m3", HeadwaySeconds: 510},
	}

	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = SimulateWhatIf(req, vehicles)
	}
}
