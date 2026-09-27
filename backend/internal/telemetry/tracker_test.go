package telemetry

import (
	"math"
	"testing"
	"time"
)

func TestTrackerFeatures(t *testing.T) {
	tracker := NewTracker(15 * time.Minute)
	now := time.Now()

	// Add points with decreasing speed (congestion trend)
	// 4 minutes ago: 30 km/h
	tracker.AddPoint("bus_1", Point{
		Timestamp: now.Add(-4 * time.Minute),
		SpeedKmh:  30.0,
	})
	// 2 minutes ago: 10 km/h
	tracker.AddPoint("bus_1", Point{
		Timestamp: now.Add(-2 * time.Minute),
		SpeedKmh:  10.0,
	})
	// 30 seconds ago: 0 km/h (idle/traffic jam)
	tracker.AddPoint("bus_1", Point{
		Timestamp: now.Add(-30 * time.Second),
		SpeedKmh:  0.0,
	})

	feat := tracker.ComputeFeatures("bus_1", now)

	if feat.SpeedKmh != 0.0 {
		t.Errorf("expected latest speed 0.0, got %v", feat.SpeedKmh)
	}

	// 3m window has points at -2m (10) and -30s (0) -> avg 5.0 km/h
	if math.Abs(feat.AvgSpeed3m-5.0) > 0.1 {
		t.Errorf("expected avg3m 5.0, got %v", feat.AvgSpeed3m)
	}

	// 5m window has points 30, 10, 0 -> avg 13.33 km/h
	if math.Abs(feat.AvgSpeed5m-13.33) > 0.5 {
		t.Errorf("expected avg5m ~13.33, got %v", feat.AvgSpeed5m)
	}

	// Trend should be negative (slowing down: 5.0 - 13.33 < 0)
	if feat.SpeedTrend >= 0 {
		t.Errorf("expected negative speed trend, got %v", feat.SpeedTrend)
	}

	// Stop ratio: 1 out of 3 points is idle (<2 km/h)
	if feat.StopRatio5m <= 0 {
		t.Errorf("expected non-zero stop ratio, got %v", feat.StopRatio5m)
	}
}
