package api

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
)

// GPSPoint is a validated GPS telemetry point from traffic.csv.
type GPSPoint struct {
	EventTime time.Time `json:"event_time"`
	Lon       float64   `json:"lon"`
	Lat       float64   `json:"lat"`
	Speed     float64   `json:"speed"`
	Heading   float64   `json:"heading"`
}

// TrackResponse contains the chronologically ordered points and their bounds.
type TrackResponse struct {
	TrID   int        `json:"tr_id"`
	Points []GPSPoint `json:"points"`
	Bounds struct {
		MinLat float64 `json:"min_lat"`
		MaxLat float64 `json:"max_lat"`
		MinLon float64 `json:"min_lon"`
		MaxLon float64 `json:"max_lon"`
	} `json:"bounds"`
}

// TrackSummary is the compact representation returned by the tracks list endpoint.
type TrackSummary struct {
	TrID       int `json:"tr_id"`
	PointCount int `json:"point_count"`
}

// TrackStore keeps the filtered traffic dataset in memory. The cache is loaded
// once during server startup and is read concurrently by HTTP handlers.
type TrackStore struct {
	mu     sync.RWMutex
	tracks map[int][]GPSPoint
}

// NewTrackStore creates an empty in-memory track cache.
func NewTrackStore() *TrackStore {
	return &TrackStore{tracks: make(map[int][]GPSPoint)}
}

// LoadTracksFromCSV reads a traffic.csv file, keeps only valid locations, and
// sorts every track chronologically by event_time. Malformed data rows are
// ignored so that one bad telemetry record does not prevent the server from
// serving the rest of the dataset.
func LoadTracksFromCSV(path string) (map[int][]GPSPoint, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	reader := csv.NewReader(file)
	reader.FieldsPerRecord = -1

	header, err := reader.Read()
	if err != nil {
		return nil, fmt.Errorf("read traffic CSV header: %w", err)
	}
	columns := make(map[string]int, len(header))
	for index, name := range header {
		name = strings.ToLower(strings.TrimSpace(strings.TrimPrefix(name, "\uFEFF")))
		columns[name] = index
	}

	requiredColumns := []string{"tr_id", "event_time", "lon", "lat", "speed", "heading", "location_valid"}
	for _, column := range requiredColumns {
		if _, ok := columns[column]; !ok {
			return nil, fmt.Errorf("traffic CSV is missing required column %q", column)
		}
	}

	tracks := make(map[int][]GPSPoint)
	for {
		record, readErr := reader.Read()
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			continue
		}

		valid, ok := parseCSVBool(csvField(record, columns["location_valid"]))
		if !ok || !valid {
			continue
		}

		trID, err := strconv.Atoi(csvField(record, columns["tr_id"]))
		if err != nil {
			continue
		}
		eventTime, err := parseEventTime(csvField(record, columns["event_time"]))
		if err != nil {
			continue
		}
		lon, err := parseFiniteFloat(csvField(record, columns["lon"]))
		if err != nil {
			continue
		}
		lat, err := parseFiniteFloat(csvField(record, columns["lat"]))
		if err != nil {
			continue
		}
		speed, err := parseFiniteFloat(csvField(record, columns["speed"]))
		if err != nil {
			continue
		}
		heading, err := parseFiniteFloat(csvField(record, columns["heading"]))
		if err != nil {
			continue
		}

		tracks[trID] = append(tracks[trID], GPSPoint{
			EventTime: eventTime,
			Lon:       lon,
			Lat:       lat,
			Speed:     speed,
			Heading:   heading,
		})
	}

	for trID := range tracks {
		sort.SliceStable(tracks[trID], func(i, j int) bool {
			return tracks[trID][i].EventTime.Before(tracks[trID][j].EventTime)
		})
		tracks[trID] = cleanTrackPoints(tracks[trID])
	}

	return tracks, nil
}

// isSVOSpoofingPoint checks whether coordinates fall into the known Sheremetyevo Airport
// GPS electronic warfare (EW/РЭБ) spoofing cluster.
func isSVOSpoofingPoint(lat, lon float64) bool {
	return lat >= 55.95 && lat <= 56.02 && lon >= 37.38 && lon <= 37.46
}

// cleanTrackPoints filters out EW spoofing anomalies when a vehicle operates outside the SVO hotspot.
func cleanTrackPoints(points []GPSPoint) []GPSPoint {
	if len(points) == 0 {
		return points
	}

	hasNonSVO := false
	for _, p := range points {
		if !isSVOSpoofingPoint(p.Lat, p.Lon) {
			hasNonSVO = true
			break
		}
	}
	// If the entire track is located in SVO, retain all points to avoid wiping it out completely.
	if !hasNonSVO {
		return points
	}

	clean := make([]GPSPoint, 0, len(points))
	for _, p := range points {
		if isSVOSpoofingPoint(p.Lat, p.Lon) {
			continue
		}
		clean = append(clean, p)
	}

	if len(clean) == 0 {
		return points
	}
	return clean
}

// LoadFromCSV replaces the store contents with the filtered CSV cache and
// returns the number of GPS points loaded.
func (s *TrackStore) LoadFromCSV(path string) (int, error) {
	tracks, err := LoadTracksFromCSV(path)
	if err != nil {
		return 0, err
	}

	pointCount := 0
	for _, points := range tracks {
		pointCount += len(points)
	}

	s.mu.Lock()
	s.tracks = tracks
	s.mu.Unlock()
	return pointCount, nil
}

// TrackCount returns the number of tracks currently cached.
func (s *TrackStore) TrackCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.tracks)
}

// PointCount returns the number of GPS points currently cached.
func (s *TrackStore) PointCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	count := 0
	for _, points := range s.tracks {
		count += len(points)
	}
	return count
}

// RegisterTrackRoutes mounts all GPS track endpoints on a chi-compatible router.
func RegisterTrackRoutes(r interface {
	Get(pattern string, handlerFn http.HandlerFunc)
}, store *TrackStore) {
	if store == nil {
		store = NewTrackStore()
	}
	r.Get("/tracks", store.handleList)
	// Register the more specific path before the parameter-only path for
	// routers that resolve patterns in declaration order.
	r.Get("/tracks/{tr_id}/geojson", store.handleGeoJSON)
	r.Get("/tracks/{tr_id}", store.handleTrack)
}

func (s *TrackStore) handleList(w http.ResponseWriter, _ *http.Request) {
	s.mu.RLock()
	tracks := make([]TrackSummary, 0, len(s.tracks))
	for trID, points := range s.tracks {
		tracks = append(tracks, TrackSummary{TrID: trID, PointCount: len(points)})
	}
	s.mu.RUnlock()

	sort.Slice(tracks, func(i, j int) bool {
		return tracks[i].TrID < tracks[j].TrID
	})
	writeJSON(w, http.StatusOK, tracks)
}

func (s *TrackStore) handleTrack(w http.ResponseWriter, r *http.Request) {
	trID, err := parseTrackID(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid tr_id")
		return
	}

	points, found := s.pointsFor(trID)
	if !found {
		writeJSONError(w, http.StatusNotFound, "track not found")
		return
	}
	writeJSON(w, http.StatusOK, makeTrackResponse(trID, points))
}

func (s *TrackStore) handleGeoJSON(w http.ResponseWriter, r *http.Request) {
	trID, err := parseTrackID(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid tr_id")
		return
	}

	points, found := s.pointsFor(trID)
	if !found {
		writeJSONError(w, http.StatusNotFound, "track not found")
		return
	}

	coordinates := make([][2]float64, len(points))
	for i, point := range points {
		coordinates[i] = [2]float64{point.Lon, point.Lat}
	}

	writeJSON(w, http.StatusOK, struct {
		Type       string `json:"type"`
		Properties struct {
			TrID       int `json:"tr_id"`
			PointCount int `json:"point_count"`
		} `json:"properties"`
		Geometry struct {
			Type        string       `json:"type"`
			Coordinates [][2]float64 `json:"coordinates"`
		} `json:"geometry"`
	}{
		Type: "Feature",
		Properties: struct {
			TrID       int `json:"tr_id"`
			PointCount int `json:"point_count"`
		}{TrID: trID, PointCount: len(points)},
		Geometry: struct {
			Type        string       `json:"type"`
			Coordinates [][2]float64 `json:"coordinates"`
		}{Type: "LineString", Coordinates: coordinates},
	})
}

func (s *TrackStore) pointsFor(trID int) ([]GPSPoint, bool) {
	s.mu.RLock()
	points, found := s.tracks[trID]
	if found {
		points = append([]GPSPoint(nil), points...)
	}
	s.mu.RUnlock()
	return points, found
}

func makeTrackResponse(trID int, points []GPSPoint) TrackResponse {
	response := TrackResponse{
		TrID:   trID,
		Points: points,
	}
	if len(points) == 0 {
		return response
	}

	minLat, maxLat := points[0].Lat, points[0].Lat
	minLon, maxLon := points[0].Lon, points[0].Lon
	for _, point := range points[1:] {
		if point.Lat < minLat {
			minLat = point.Lat
		}
		if point.Lat > maxLat {
			maxLat = point.Lat
		}
		if point.Lon < minLon {
			minLon = point.Lon
		}
		if point.Lon > maxLon {
			maxLon = point.Lon
		}
	}
	response.Bounds.MinLat = minLat
	response.Bounds.MaxLat = maxLat
	response.Bounds.MinLon = minLon
	response.Bounds.MaxLon = maxLon
	return response
}

func parseTrackID(r *http.Request) (int, error) {
	return strconv.Atoi(strings.TrimSpace(chi.URLParam(r, "tr_id")))
}

func csvField(record []string, index int) string {
	if index < 0 || index >= len(record) {
		return ""
	}
	return strings.TrimSpace(record[index])
}

func parseCSVBool(value string) (bool, bool) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "true", "t", "yes", "y":
		return true, true
	case "0", "false", "f", "no", "n":
		return false, true
	default:
		return false, false
	}
}

func parseFiniteFloat(value string) (float64, error) {
	parsed, err := strconv.ParseFloat(strings.TrimSpace(value), 64)
	if err != nil || math.IsNaN(parsed) || math.IsInf(parsed, 0) {
		if err == nil {
			err = fmt.Errorf("non-finite float")
		}
		return 0, err
	}
	return parsed, nil
}

func parseEventTime(value string) (time.Time, error) {
	value = strings.TrimSpace(value)
	layouts := []string{
		time.RFC3339Nano,
		"2006-01-02 15:04:05.999999999",
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05.999999999",
		"2006-01-02T15:04:05",
	}
	for _, layout := range layouts {
		if parsed, err := time.Parse(layout, value); err == nil {
			return parsed, nil
		}
	}
	return time.Time{}, fmt.Errorf("unsupported event_time %q", value)
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeJSONError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
