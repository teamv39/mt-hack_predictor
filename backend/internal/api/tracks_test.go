package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/go-chi/chi/v5"
)

func TestLoadTracksFromCSVFiltersAndSorts(t *testing.T) {
	path := filepath.Join(t.TempDir(), "traffic.csv")
	contents := "tr_id,event_time,lon,lat,speed,heading,location_valid\n" +
		"42,2026-01-06 12:01:00,37.2,55.2,20,180,True\n" +
		"42,2026-01-06 12:00:00,37.1,55.1,18,170,True\n" +
		"42,2026-01-06 12:02:00,,,,,False\n" +
		"broken,2026-01-06 12:03:00,37.3,55.3,20,180,True\n"
	if err := os.WriteFile(path, []byte(contents), 0o600); err != nil {
		t.Fatal(err)
	}

	tracks, err := LoadTracksFromCSV(path)
	if err != nil {
		t.Fatalf("LoadTracksFromCSV() error = %v", err)
	}
	points := tracks[42]
	if len(points) != 2 {
		t.Fatalf("expected 2 valid points, got %d", len(points))
	}
	if !points[0].EventTime.Before(points[1].EventTime) {
		t.Fatalf("points are not sorted chronologically: %v, %v", points[0].EventTime, points[1].EventTime)
	}
	if points[0].Lon != 37.1 || points[0].Lat != 55.1 {
		t.Fatalf("unexpected first point: %+v", points[0])
	}
}

func TestTrackRoutesReturnResponseAndGeoJSON(t *testing.T) {
	store := NewTrackStore()
	store.tracks = map[int][]GPSPoint{
		42: {
			{Lon: 37.1, Lat: 55.1},
			{Lon: 37.2, Lat: 55.3},
		},
	}

	r := chi.NewRouter()
	RegisterTrackRoutes(r, store)

	record := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/tracks", nil)
	r.ServeHTTP(record, req)
	if record.Code != http.StatusOK {
		t.Fatalf("GET /tracks status = %d", record.Code)
	}
	var summaries []TrackSummary
	if err := json.NewDecoder(record.Body).Decode(&summaries); err != nil {
		t.Fatal(err)
	}
	if len(summaries) != 1 || summaries[0].TrID != 42 || summaries[0].PointCount != 2 {
		t.Fatalf("unexpected track summaries: %+v", summaries)
	}

	record = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/tracks/42", nil)
	r.ServeHTTP(record, req)
	if record.Code != http.StatusOK {
		t.Fatalf("GET /tracks/{tr_id} status = %d", record.Code)
	}
	var response TrackResponse
	if err := json.NewDecoder(record.Body).Decode(&response); err != nil {
		t.Fatal(err)
	}
	if response.TrID != 42 || len(response.Points) != 2 {
		t.Fatalf("unexpected track response: %+v", response)
	}
	if response.Bounds.MinLat != 55.1 || response.Bounds.MaxLat != 55.3 ||
		response.Bounds.MinLon != 37.1 || response.Bounds.MaxLon != 37.2 {
		t.Fatalf("unexpected bounds: %+v", response.Bounds)
	}

	record = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/tracks/42/geojson", nil)
	r.ServeHTTP(record, req)
	if record.Code != http.StatusOK {
		t.Fatalf("GET /tracks/{tr_id}/geojson status = %d", record.Code)
	}
	var geojson struct {
		Type     string `json:"type"`
		Geometry struct {
			Type        string       `json:"type"`
			Coordinates [][2]float64 `json:"coordinates"`
		} `json:"geometry"`
	}
	if err := json.NewDecoder(record.Body).Decode(&geojson); err != nil {
		t.Fatal(err)
	}
	if geojson.Type != "Feature" || geojson.Geometry.Type != "LineString" || len(geojson.Geometry.Coordinates) != 2 {
		t.Fatalf("unexpected GeoJSON response: %+v", geojson)
	}
}

func TestTrackRoutesRejectInvalidAndMissingTrack(t *testing.T) {
	r := chi.NewRouter()
	RegisterTrackRoutes(r, NewTrackStore())

	for path, wantStatus := range map[string]int{
		"/tracks/not-an-int": http.StatusBadRequest,
		"/tracks/42":         http.StatusNotFound,
		"/tracks/42/geojson": http.StatusNotFound,
	} {
		record := httptest.NewRecorder()
		r.ServeHTTP(record, httptest.NewRequest(http.MethodGet, path, nil))
		if record.Code != wantStatus {
			t.Errorf("GET %s status = %d, want %d", path, record.Code, wantStatus)
		}
	}
}

func TestTrackRoutesLimitQueryParam(t *testing.T) {
	store := NewTrackStore()
	store.tracks = map[int][]GPSPoint{
		1: {{Lon: 37.1, Lat: 55.1}},
		2: {{Lon: 37.2, Lat: 55.2}},
		3: {{Lon: 37.3, Lat: 55.3}},
	}

	r := chi.NewRouter()
	RegisterTrackRoutes(r, store)

	record := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/tracks?limit=2", nil)
	r.ServeHTTP(record, req)
	if record.Code != http.StatusOK {
		t.Fatalf("GET /tracks?limit=2 status = %d", record.Code)
	}
	var summaries []TrackSummary
	if err := json.NewDecoder(record.Body).Decode(&summaries); err != nil {
		t.Fatal(err)
	}
	if len(summaries) != 2 {
		t.Fatalf("expected 2 tracks with limit=2, got %d", len(summaries))
	}
}

