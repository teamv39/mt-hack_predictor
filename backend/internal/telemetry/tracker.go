package telemetry

import (
	"sync"
	"time"
)

// Point is an in-memory telemetry record for sliding window metrics.
type Point struct {
	Timestamp time.Time
	Latitude  float64
	Longitude float64
	SpeedKmh  float64
	Bearing   float64
}

// VehicleHistory holds sliding window telemetry for one vehicle.
type VehicleHistory struct {
	points []Point
}

// Features contains computed telemetry dynamics for ML inference.
type Features struct {
	SpeedKmh      float64
	AvgSpeed3m    float64
	AvgSpeed5m    float64
	AvgSpeed10m   float64
	IdleTime5m    float64 // Seconds with speed < 2 km/h in last 5m
	StopRatio5m   float64 // Fraction of time idle in last 5m
	SpeedTrend    float64 // avg3m - avg10m
	TelemetryAgeS float64
	PointsCount   int
}

// Tracker stores and aggregates sliding windows of telemetry across all units.
type Tracker struct {
	mu           sync.RWMutex
	maxAge       time.Duration
	histories    map[string]*VehicleHistory
}

// NewTracker creates a new telemetry tracker with a default 15-minute history window.
func NewTracker(maxAge time.Duration) *Tracker {
	if maxAge <= 0 {
		maxAge = 15 * time.Minute
	}
	return &Tracker{
		maxAge:    maxAge,
		histories: make(map[string]*VehicleHistory),
	}
}

// AddPoint records a new telemetry point and prunes points older than maxAge.
func (t *Tracker) AddPoint(vehicleID string, p Point) {
	if p.Timestamp.IsZero() {
		p.Timestamp = time.Now().UTC()
	}

	t.mu.Lock()
	defer t.mu.Unlock()

	h, ok := t.histories[vehicleID]
	if !ok {
		h = &VehicleHistory{points: make([]Point, 0, 64)}
		t.histories[vehicleID] = h
	}

	h.points = append(h.points, p)

	// Prune old points
	cutoff := p.Timestamp.Add(-t.maxAge)
	startIdx := 0
	for startIdx < len(h.points) && h.points[startIdx].Timestamp.Before(cutoff) {
		startIdx++
	}
	if startIdx > 0 {
		h.points = h.points[startIdx:]
	}
}

// ComputeFeatures calculates derived rolling dynamics for a vehicle.
func (t *Tracker) ComputeFeatures(vehicleID string, now time.Time) Features {
	t.mu.RLock()
	defer t.mu.RUnlock()

	h, ok := t.histories[vehicleID]
	if !ok || len(h.points) == 0 {
		return Features{
			SpeedKmh:      15.0,
			AvgSpeed3m:    15.0,
			AvgSpeed5m:    15.0,
			AvgSpeed10m:   15.0,
			IdleTime5m:    0.0,
			StopRatio5m:   0.0,
			SpeedTrend:    0.0,
			TelemetryAgeS: 999.0,
			PointsCount:   0,
		}
	}

	points := h.points
	last := points[len(points)-1]

	refTime := now
	if refTime.IsZero() || refTime.Before(last.Timestamp) {
		refTime = last.Timestamp
	}

	telemAge := refTime.Sub(last.Timestamp).Seconds()
	if telemAge < 0 {
		telemAge = 0
	}

	avg3m := avgSpeedWindow(points, refTime, 3*time.Minute, last.SpeedKmh)
	avg5m := avgSpeedWindow(points, refTime, 5*time.Minute, last.SpeedKmh)
	avg10m := avgSpeedWindow(points, refTime, 10*time.Minute, last.SpeedKmh)

	idleSec, stopRatio := calcIdleStats(points, refTime, 5*time.Minute)

	return Features{
		SpeedKmh:      last.SpeedKmh,
		AvgSpeed3m:    avg3m,
		AvgSpeed5m:    avg5m,
		AvgSpeed10m:   avg10m,
		IdleTime5m:    idleSec,
		StopRatio5m:   stopRatio,
		SpeedTrend:    avg3m - avg10m,
		TelemetryAgeS: telemAge,
		PointsCount:   len(points),
	}
}

func avgSpeedWindow(points []Point, refTime time.Time, window time.Duration, defaultSpeed float64) float64 {
	cutoff := refTime.Add(-window)
	sum := 0.0
	cnt := 0

	for i := len(points) - 1; i >= 0; i-- {
		if points[i].Timestamp.Before(cutoff) {
			break
		}
		sum += points[i].SpeedKmh
		cnt++
	}

	if cnt == 0 {
		return defaultSpeed
	}
	return sum / float64(cnt)
}

func calcIdleStats(points []Point, refTime time.Time, window time.Duration) (idleSeconds float64, stopRatio float64) {
	cutoff := refTime.Add(-window)
	idleCount := 0
	totalCount := 0

	for i := len(points) - 1; i >= 0; i-- {
		if points[i].Timestamp.Before(cutoff) {
			break
		}
		totalCount++
		if points[i].SpeedKmh < 2.0 {
			idleCount++
		}
	}

	if totalCount == 0 {
		return 0, 0
	}

	ratio := float64(idleCount) / float64(totalCount)
	return ratio * window.Seconds(), ratio
}
