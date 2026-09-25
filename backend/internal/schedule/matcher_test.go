package schedule

import (
	"math"
	"testing"
	"time"
)

func TestParseWKTPoint(t *testing.T) {
	cases := []struct {
		wkt     string
		wantLon float64
		wantLat float64
		wantErr bool
	}{
		{"POINT (37.43070705 55.8040083)", 37.43070705, 55.8040083, false},
		{"point(  37.5  55.7 )", 37.5, 55.7, false},
		{"INVALID", 0, 0, true},
	}

	for _, tc := range cases {
		lon, lat, err := ParseWKTPoint(tc.wkt)
		if (err != nil) != tc.wantErr {
			t.Errorf("ParseWKTPoint(%q) error = %v, wantErr = %v", tc.wkt, err, tc.wantErr)
			continue
		}
		if !tc.wantErr {
			if math.Abs(lon-tc.wantLon) > 1e-6 || math.Abs(lat-tc.wantLat) > 1e-6 {
				t.Errorf("ParseWKTPoint(%q) = (%v, %v), want (%v, %v)", tc.wkt, lon, lat, tc.wantLon, tc.wantLat)
			}
		}
	}
}

func TestHaversineDistanceM(t *testing.T) {
	// Moscow Red Square to Belorussky station (~4.0 km)
	lat1, lon1 := 55.7539, 37.6208
	lat2, lon2 := 55.7770, 37.5818

	d := HaversineDistanceM(lat1, lon1, lat2, lon2)
	if d < 3500 || d > 4500 {
		t.Fatalf("unexpected distance: %v meters, expected ~4000m", d)
	}
}

func TestMatcherVehicle(t *testing.T) {
	m := NewMatcher()

	now := time.Date(2026, 1, 6, 8, 0, 0, 0, time.UTC)

	// Add 2 stops for vehicle 101
	m.AddStop(Stop{
		ID:        "stop_1",
		TrID:      "101",
		TimeBegin: now.Add(10 * time.Minute),
		Latitude:  55.7500,
		Longitude: 37.6100,
		Address:   "Остановка 1 (Метро)",
	})
	m.AddStop(Stop{
		ID:        "stop_2",
		TrID:      "101",
		TimeBegin: now.Add(20 * time.Minute),
		Latitude:  55.7600,
		Longitude: 37.6200,
		Address:   "Остановка 2 (Площадь)",
	})

	// Match vehicle near stop 1
	res := m.MatchVehicle("101", 55.7490, 37.6090, now)
	if !res.Matched {
		t.Fatalf("expected matched = true")
	}
	if res.StopID != "stop_1" {
		t.Errorf("expected StopID stop_1, got %s", res.StopID)
	}
	if res.DistanceMeters <= 0 || res.DistanceMeters > 500 {
		t.Errorf("unexpected distance: %v m", res.DistanceMeters)
	}

	// Match unknown vehicle (spatial fallback)
	resFallback := m.MatchVehicle("999", 55.7595, 37.6195, now)
	if !resFallback.Matched {
		t.Fatalf("expected fallback matched = true")
	}
	if resFallback.StopID != "stop_2" {
		t.Errorf("expected StopID stop_2 via spatial nearest, got %s", resFallback.StopID)
	}
}
