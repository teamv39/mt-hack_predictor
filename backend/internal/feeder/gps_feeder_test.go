package feeder

import (
	"testing"
	"time"

	"github.com/mt-hack-predictor/backend/internal/api"
	"github.com/mt-hack-predictor/backend/internal/engine"
)

func TestGPSFeeder_InterpolationAndAdvance(t *testing.T) {
	t0 := time.Date(2026, 1, 6, 8, 0, 0, 0, time.UTC)
	t1 := time.Date(2026, 1, 6, 8, 0, 10, 0, time.UTC)
	t2 := time.Date(2026, 1, 6, 8, 0, 20, 0, time.UTC)

	tracks := map[int][]api.GPSPoint{
		1001: {
			{EventTime: t0, Lat: 55.750, Lon: 37.610, Speed: 20.0, Heading: 90.0},
			{EventTime: t1, Lat: 55.760, Lon: 37.620, Speed: 30.0, Heading: 90.0},
			{EventTime: t2, Lat: 55.770, Lon: 37.630, Speed: 40.0, Heading: 90.0},
		},
	}

	hw := engine.NewHeadwayCalculator(480.0)
	alertMgr := engine.NewAlertManager()
	gf := NewGPSFeeder(tracks, nil, hw, alertMgr, nil)

	if gf.GetSpeed() != 1.0 {
		t.Fatalf("expected default speed 1.0, got %f", gf.GetSpeed())
	}

	vehicles, _, status := gf.GetState()
	if len(vehicles) != 1 {
		t.Fatalf("expected 1 active vehicle at t0, got %d", len(vehicles))
	}
	if vehicles[0].ID != "P1001" {
		t.Fatalf("expected vehicle ID P1001, got %s", vehicles[0].ID)
	}
	if vehicles[0].Latitude != 55.750 || vehicles[0].Longitude != 37.610 {
		t.Fatalf("expected exact t0 position (55.750, 37.610), got (%f, %f)", vehicles[0].Latitude, vehicles[0].Longitude)
	}

	// Set speed to 10x and advance tick: 500ms at 10x speed = 5 seconds advance
	gf.SetSpeed(10.0)
	gf.AdvanceTick(500 * time.Millisecond)

	vehicles, _, status = gf.GetState()
	if len(vehicles) != 1 {
		t.Fatalf("expected 1 active vehicle after tick, got %d", len(vehicles))
	}
	// At t = 8:00:05 (halfway between t0 and t1): lat=55.755, lon=37.615, speed=25.0
	expectedLat := 55.755
	expectedLon := 37.615
	if (vehicles[0].Latitude-expectedLat) > 1e-4 || (vehicles[0].Longitude-expectedLon) > 1e-4 {
		t.Fatalf("expected interpolated pos (%f, %f), got (%f, %f)", expectedLat, expectedLon, vehicles[0].Latitude, vehicles[0].Longitude)
	}
	if vehicles[0].SpeedKmH != 25.0 {
		t.Fatalf("expected interpolated speed 25.0, got %f", vehicles[0].SpeedKmH)
	}

	if status.ActiveVehiclesCount != 1 {
		t.Fatalf("expected status.ActiveVehiclesCount == 1, got %d", status.ActiveVehiclesCount)
	}
}

func TestGPSFeeder_ControlsAndHolding(t *testing.T) {
	t0 := time.Date(2026, 1, 6, 8, 0, 0, 0, time.UTC)
	t1 := time.Date(2026, 1, 6, 8, 1, 0, 0, time.UTC)

	tracks := map[int][]api.GPSPoint{
		2002: {
			{EventTime: t0, Lat: 55.750, Lon: 37.610, Speed: 20.0, Heading: 90.0},
			{EventTime: t1, Lat: 55.760, Lon: 37.620, Speed: 30.0, Heading: 90.0},
		},
	}

	gf := NewGPSFeeder(tracks, nil, nil, nil, nil)
	gf.SetSpeed(30.0)
	if gf.GetSpeed() != 30.0 {
		t.Fatalf("expected speed 30.0, got %f", gf.GetSpeed())
	}

	// Apply holding to P2002 for 60 seconds
	gf.ApplyHolding("P2002", 60)
	gf.AdvanceTick(100 * time.Millisecond) // advances simTime slightly

	vehicles, _, _ := gf.GetState()
	if len(vehicles) == 0 {
		t.Fatalf("expected active vehicle")
	}
	if vehicles[0].Status != "REGULATING" {
		t.Fatalf("expected status REGULATING during holding, got %s", vehicles[0].Status)
	}
	if vehicles[0].SpeedKmH != 0.0 {
		t.Fatalf("expected speed 0.0 during holding, got %f", vehicles[0].SpeedKmH)
	}

	// Pause
	gf.SetPlaying(false)
	simTimeBefore := gf.GetSimTime()
	gf.AdvanceTick(1 * time.Second)
	if !gf.GetSimTime().Equal(simTimeBefore) {
		t.Fatalf("expected simTime not to advance when paused")
	}

	// Reset
	gf.Reset()
	if !gf.GetSimTime().Equal(t0) {
		t.Fatalf("expected simTime to equal startTime after reset")
	}
}
