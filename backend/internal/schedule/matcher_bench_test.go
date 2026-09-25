package schedule

import (
	"fmt"
	"testing"
	"time"
)

func BenchmarkHaversineDistanceM(b *testing.B) {
	lat1, lon1 := 55.7558, 37.6173
	lat2, lon2 := 55.7512, 37.6185

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = HaversineDistanceM(lat1, lon1, lat2, lon2)
	}
}

func BenchmarkScheduleMatcher_MatchVehicle(b *testing.B) {
	matcher := NewMatcher()
	now := time.Now()

	// Populate with 200 stops for vehicle
	trID := "unit-1043"
	stops := make([]Stop, 200)
	for i := 0; i < 200; i++ {
		stops[i] = Stop{
			ID:        fmt.Sprintf("stop-%d", i),
			TrID:      trID,
			TimeBegin: now.Add(time.Duration(i*3) * time.Minute),
			Latitude:  55.7500 + float64(i)*0.001,
			Longitude: 37.6100 + float64(i)*0.001,
			Address:   fmt.Sprintf("Stop Address %d", i),
		}
	}
	matcher.stopsByTrID[trID] = stops
	matcher.allStops = stops

	curLat, curLon := 55.7650, 37.6250
	curTime := now.Add(45 * time.Minute)

	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = matcher.MatchVehicle(trID, curLat, curLon, curTime)
	}
}
