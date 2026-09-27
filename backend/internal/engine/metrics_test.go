package engine

import (
	"testing"

	"github.com/mt-hack-predictor/backend/internal/models"
)

func TestComputeBusinessKPIs(t *testing.T) {
	vehicles := []models.Vehicle{
		{ID: "bus_1", Status: "ON_TIME", HeadwaySeconds: 480.0},
		{ID: "bus_2", Status: "BUNCHING_RISK", HeadwaySeconds: 90.0},
		{ID: "bus_3", Status: "DELAYED", HeadwaySeconds: 870.0},
	}
	alerts := []models.Alert{
		{ID: "alert_1", Type: "BUS_BUNCHING"},
	}

	kpis := ComputeBusinessKPIs(vehicles, alerts, 5)

	if kpis.ActiveTrackedVehicles != 3 {
		t.Errorf("expected 3 vehicles, got %d", kpis.ActiveTrackedVehicles)
	}
	if kpis.PreventedIncidentsCount != 5 {
		t.Errorf("expected 5 prevented incidents, got %d", kpis.PreventedIncidentsCount)
	}
	if kpis.SavedPassengerHoursDaily <= 0 {
		t.Errorf("expected positive saved hours, got %v", kpis.SavedPassengerHoursDaily)
	}
	if kpis.EconomicSavingsRubDaily <= 0 {
		t.Errorf("expected positive savings, got %v", kpis.EconomicSavingsRubDaily)
	}
	if kpis.AveragePassengerWaitMin <= 0 {
		t.Errorf("expected positive average wait min, got %v", kpis.AveragePassengerWaitMin)
	}
}
