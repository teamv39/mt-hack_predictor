package feeder

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestFeeder_Lifecycle(t *testing.T) {
	// Create a temporary scenario JSON
	tmpDir := t.TempDir()
	scenarioPath := filepath.Join(tmpDir, "test_scenario.json")

	data := ScenarioData{
		Route: ScenarioRoute{
			ID:    "m3",
			Name:  "м3",
			Title: "Магистраль м3",
			Color: "#d32f2f",
			Stops: []ScenarioStop{
				{ID: "s1", Name: "Стоп 1", Lat: 55.75, Lon: 37.60, DistM: 0},
				{ID: "s2", Name: "Стоп 2", Lat: 55.76, Lon: 37.62, DistM: 1500},
			},
			Polyline: []Point{
				{Lat: 55.75, Lon: 37.60},
				{Lat: 55.76, Lon: 37.62},
			},
		},
		Frames: []ScenarioFrame{
			{
				Tick:           0,
				SimTimeSeconds: 0,
				Vehicles: []ScenarioVehicleFrame{
					{
						ID:             "1043",
						RouteID:        "m3",
						Latitude:       55.75,
						Longitude:      37.60,
						LatitudeHeld:   55.751,
						LongitudeHeld:  37.601,
						SpeedKmH:       20.0,
						DelaySeconds:   60.0,
						HeadwaySeconds: 120.0,
						Status:         "DELAYED",
					},
				},
			},
			{
				Tick:           1,
				SimTimeSeconds: 60,
				Vehicles: []ScenarioVehicleFrame{
					{
						ID:             "1043",
						RouteID:        "m3",
						Latitude:       55.76,
						Longitude:      37.62,
						SpeedKmH:       25.0,
						DelaySeconds:   30.0,
						HeadwaySeconds: 480.0,
						Status:         "ON_TIME",
					},
				},
			},
		},
	}

	b, err := json.Marshal(data)
	if err != nil {
		t.Fatalf("failed to marshal test scenario: %v", err)
	}
	if err := os.WriteFile(scenarioPath, b, 0644); err != nil {
		t.Fatalf("failed to write scenario file: %v", err)
	}

	// 1. Test LoadScenario
	f, err := LoadScenario("non_existent_file.json", scenarioPath)
	if err != nil {
		t.Fatalf("LoadScenario failed: %v", err)
	}

	// 2. Test GetRoute
	route := f.GetRoute()
	if route.ID != "m3" || len(route.Stops) != 2 {
		t.Errorf("unexpected route data: %+v", route)
	}

	// 3. Test Initial State
	vehs, _, status := f.GetState()
	if len(vehs) != 1 || vehs[0].ID != "1043" {
		t.Fatalf("unexpected vehicles in tick 0: %+v", vehs)
	}
	if vehs[0].Latitude != 55.75 {
		t.Errorf("expected lat 55.75, got %f", vehs[0].Latitude)
	}
	if !status.LiveSimulationActive {
		t.Errorf("expected LiveSimulationActive to be true")
	}

	// 4. Test AdvanceTick
	f.AdvanceTick()
	vehs, _, _ = f.GetState()
	if vehs[0].Latitude != 55.76 {
		t.Errorf("expected tick 1 lat 55.76, got %f", vehs[0].Latitude)
	}

	// 5. Test Reset
	f.Reset()
	vehs, _, _ = f.GetState()
	if vehs[0].Latitude != 55.75 {
		t.Errorf("expected reset to tick 0 lat 55.75, got %f", vehs[0].Latitude)
	}

	// 6. Test ApplyHolding
	f.ApplyHolding(true)
	if !f.IsHoldingApplied() {
		t.Errorf("expected holding applied to be true")
	}
	vehs, _, status = f.GetState()
	if vehs[0].Latitude != 55.751 || vehs[0].Longitude != 37.601 {
		t.Errorf("expected held coordinates (55.751, 37.601), got (%f, %f)", vehs[0].Latitude, vehs[0].Longitude)
	}
	if vehs[0].Status != "ON_TIME" {
		t.Errorf("expected status ON_TIME when held, got %s", vehs[0].Status)
	}

	// 7. Test Speed & Playing controls
	f.SetSpeed(2.5)
	if f.GetSpeed() != 2.5 {
		t.Errorf("expected speed 2.5, got %f", f.GetSpeed())
	}
	f.SetSpeed(-1.0)
	if f.GetSpeed() != 1.0 {
		t.Errorf("expected fallback speed 1.0 for non-positive, got %f", f.GetSpeed())
	}
	f.SetPlaying(false)
	f.AdvanceTick()
	vehs, _, _ = f.GetState()
	if vehs[0].Latitude != 55.751 {
		t.Errorf("AdvanceTick should be no-op when not playing")
	}
}
