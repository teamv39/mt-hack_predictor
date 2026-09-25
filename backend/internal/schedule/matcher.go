package schedule

import (
	"encoding/csv"
	"fmt"
	"io"
	"math"
	"os"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

// EarthRadiusM is mean Earth radius in meters
const EarthRadiusM = 6371000.0

var wktPointRe = regexp.MustCompile(`(?i)POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)`)

// Stop represents a timetable stop entry
type Stop struct {
	ID          string
	TrID        string
	TimeBegin   time.Time
	Latitude    float64
	Longitude   float64
	Address     string
	ManualFill  bool
}

// MatchResult contains schedule matching outcome for a vehicle point
type MatchResult struct {
	Matched         bool      `json:"matched"`
	StopID          string    `json:"stop_id"`
	StopName        string    `json:"stop_name"`
	DistanceMeters  float64   `json:"distance_meters"`
	CurDevSeconds   float64   `json:"cur_dev_s"`
	PlannedTime     time.Time `json:"planned_time"`
	HorizonSeconds  float64   `json:"horizon_sec"`
}

// Matcher indexes timetable stops by vehicle ID and spatial coordinates.
type Matcher struct {
	mu           sync.RWMutex
	stopsByTrID  map[string][]Stop // sorted chronologically by TimeBegin
	allStops     []Stop            // all unique stops for spatial nearest-neighbor
}

// NewMatcher creates an empty schedule matcher.
func NewMatcher() *Matcher {
	return &Matcher{
		stopsByTrID: make(map[string][]Stop),
		allStops:    make([]Stop, 0),
	}
}

// HaversineDistanceM computes geodesic distance in meters between two lat/lon points.
func HaversineDistanceM(lat1, lon1, lat2, lon2 float64) float64 {
	rad := math.Pi / 180.0
	phi1 := lat1 * rad
	phi2 := lat2 * rad
	dPhi := (lat2 - lat1) * rad
	dLambda := (lon2 - lon1) * rad

	a := math.Sin(dPhi/2.0)*math.Sin(dPhi/2.0) +
		math.Cos(phi1)*math.Cos(phi2)*math.Sin(dLambda/2.0)*math.Sin(dLambda/2.0)
	c := 2.0 * math.Atan2(math.Sqrt(a), math.Sqrt(1.0-a))
	return EarthRadiusM * c
}

// ParseWKTPoint extracts (lon, lat) from a WKT POINT string: "POINT (lon lat)".
func ParseWKTPoint(wkt string) (lon, lat float64, err error) {
	m := wktPointRe.FindStringSubmatch(strings.TrimSpace(wkt))
	if len(m) != 3 {
		return 0, 0, fmt.Errorf("invalid WKT point: %s", wkt)
	}
	lon, err = strconv.ParseFloat(m[1], 64)
	if err != nil {
		return 0, 0, err
	}
	lat, err = strconv.ParseFloat(m[2], 64)
	if err != nil {
		return 0, 0, err
	}
	return lon, lat, nil
}

// LoadFromCSV reads a timetable CSV file (schedule.csv or schedule_plan.csv).
func (m *Matcher) LoadFromCSV(csvPath string) (int, error) {
	f, err := os.Open(csvPath)
	if err != nil {
		return 0, err
	}
	defer f.Close()

	reader := csv.NewReader(f)
	header, err := reader.Read()
	if err != nil {
		return 0, err
	}

	colIdx := make(map[string]int)
	for i, h := range header {
		colIdx[strings.TrimSpace(h)] = i
	}

	idCol, hasID := colIdx["tt_action_item_id"]
	timeCol, hasTime := colIdx["time_begin"]
	trCol, hasTr := colIdx["tr_id"]
	geomCol, hasGeom := colIdx["geom"]
	addrCol := colIdx["building_address"]

	if !hasID || !hasTime || !hasTr || !hasGeom {
		return 0, fmt.Errorf("missing required columns in schedule CSV: %+v", colIdx)
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	timeLayouts := []string{
		"2006-01-02 15:04:05.000000000",
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05Z07:00",
		time.RFC3339,
	}

	count := 0
	seenStopIDs := make(map[string]bool)

	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			continue
		}

		stopID := strings.TrimSpace(record[idCol])
		trID := strings.TrimSpace(record[trCol])
		timeStr := strings.TrimSpace(record[timeCol])
		geomStr := strings.TrimSpace(record[geomCol])

		lon, lat, err := ParseWKTPoint(geomStr)
		if err != nil {
			continue
		}

		var parsedTime time.Time
		for _, layout := range timeLayouts {
			if t, err := time.Parse(layout, timeStr); err == nil {
				parsedTime = t
				break
			}
		}

		address := ""
		if addrCol >= 0 && addrCol < len(record) {
			address = strings.Trim(strings.TrimSpace(record[addrCol]), `"`)
		}

		stop := Stop{
			ID:        stopID,
			TrID:      trID,
			TimeBegin: parsedTime,
			Latitude:  lat,
			Longitude: lon,
			Address:   address,
		}

		m.stopsByTrID[trID] = append(m.stopsByTrID[trID], stop)
		if !seenStopIDs[stopID] {
			seenStopIDs[stopID] = true
			m.allStops = append(m.allStops, stop)
		}
		count++
	}

	// Sort stops chronologically for each vehicle
	for trID := range m.stopsByTrID {
		sort.Slice(m.stopsByTrID[trID], func(i, j int) bool {
			return m.stopsByTrID[trID][i].TimeBegin.Before(m.stopsByTrID[trID][j].TimeBegin)
		})
	}

	return count, nil
}

// AddStop registers a stop programmatically (useful for testing or fallback routes).
func (m *Matcher) AddStop(stop Stop) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.stopsByTrID[stop.TrID] = append(m.stopsByTrID[stop.TrID], stop)
	m.allStops = append(m.allStops, stop)

	sort.Slice(m.stopsByTrID[stop.TrID], func(i, j int) bool {
		return m.stopsByTrID[stop.TrID][i].TimeBegin.Before(m.stopsByTrID[stop.TrID][j].TimeBegin)
	})
}

// MatchVehicle finds upcoming target stop, distance, and current deviation from schedule.
func (m *Matcher) MatchVehicle(trID string, lat, lon float64, currentEventTime time.Time) MatchResult {
	m.mu.RLock()
	defer m.mu.RUnlock()

	stops, hasTr := m.stopsByTrID[trID]
	if !hasTr || len(stops) == 0 {
		// Fallback to spatial nearest stop from all registered stops
		return m.matchNearestSpatial(lat, lon, currentEventTime)
	}

	// 1. Look for the next upcoming stop after currentEventTime
	var upcomingStop *Stop
	for i := range stops {
		if !stops[i].TimeBegin.IsZero() && stops[i].TimeBegin.After(currentEventTime) {
			upcomingStop = &stops[i]
			break
		}
	}

	// If no upcoming stop found by timestamp, pick the spatially nearest stop on this vehicle's route
	if upcomingStop == nil {
		minDist := math.MaxFloat64
		for i := range stops {
			d := HaversineDistanceM(lat, lon, stops[i].Latitude, stops[i].Longitude)
			if d < minDist {
				minDist = d
				upcomingStop = &stops[i]
			}
		}
	}

	if upcomingStop == nil {
		return MatchResult{Matched: false}
	}

	dist := HaversineDistanceM(lat, lon, upcomingStop.Latitude, upcomingStop.Longitude)
	
	// Calculate horizon and delay deviation
	horizonSec := 660.0 // Default 11 min
	curDevSec := 0.0

	if !upcomingStop.TimeBegin.IsZero() && !currentEventTime.IsZero() {
		horizonSec = upcomingStop.TimeBegin.Sub(currentEventTime).Seconds()
		// If vehicle is approaching, estimate arrival time based on distance assuming average speed 20 km/h (5.55 m/s)
		estTravelSec := dist / 5.55
		estArrival := currentEventTime.Add(time.Duration(estTravelSec * float64(time.Second)))
		curDevSec = estArrival.Sub(upcomingStop.TimeBegin).Seconds()
	}

	return MatchResult{
		Matched:        true,
		StopID:         upcomingStop.ID,
		StopName:       upcomingStop.Address,
		DistanceMeters: dist,
		CurDevSeconds:  curDevSec,
		PlannedTime:    upcomingStop.TimeBegin,
		HorizonSeconds: horizonSec,
	}
}

func (m *Matcher) matchNearestSpatial(lat, lon float64, currentEventTime time.Time) MatchResult {
	if len(m.allStops) == 0 {
		return MatchResult{Matched: false}
	}

	minDist := math.MaxFloat64
	var nearest *Stop

	for i := range m.allStops {
		d := HaversineDistanceM(lat, lon, m.allStops[i].Latitude, m.allStops[i].Longitude)
		if d < minDist {
			minDist = d
			nearest = &m.allStops[i]
		}
	}

	if nearest == nil {
		return MatchResult{Matched: false}
	}

	return MatchResult{
		Matched:        true,
		StopID:         nearest.ID,
		StopName:       nearest.Address,
		DistanceMeters: minDist,
		CurDevSeconds:  0.0,
		PlannedTime:    nearest.TimeBegin,
		HorizonSeconds: 660.0,
	}
}

// StopsCount returns the number of indexed stops
func (m *Matcher) StopsCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.allStops)
}
