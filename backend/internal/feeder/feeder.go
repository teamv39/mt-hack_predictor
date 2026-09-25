package feeder

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"time"

	"github.com/mt-hack-predictor/backend/internal/models"
)

// ScenarioStop represents a stop in route geometry
type ScenarioStop struct {
	ID    string  `json:"id"`
	Name  string  `json:"name"`
	Lat   float64 `json:"lat"`
	Lon   float64 `json:"lon"`
	DistM float64 `json:"dist_m"`
}

// Point represents lat/lon coordinate
type Point struct {
	Lat float64 `json:"lat"`
	Lon float64 `json:"lon"`
}

// ScenarioRoute represents route metadata and polyline
type ScenarioRoute struct {
	ID       string         `json:"id"`
	Name     string         `json:"name"`
	Title    string         `json:"title"`
	Color    string         `json:"color"`
	Stops    []ScenarioStop `json:"stops"`
	Polyline []Point        `json:"polyline"`
}

// ScenarioVehicleFrame holds vehicle snapshot with optional held coordinates
type ScenarioVehicleFrame struct {
	ID             string  `json:"id"`
	RouteID        string  `json:"route_id"`
	TripID         string  `json:"trip_id"`
	Latitude       float64 `json:"latitude"`
	Longitude      float64 `json:"longitude"`
	LatitudeHeld   float64 `json:"latitude_held,omitempty"`
	LongitudeHeld  float64 `json:"longitude_held,omitempty"`
	Bearing        float64 `json:"bearing"`
	SpeedKmH       float64 `json:"speed_kmh"`
	DelaySeconds   float64 `json:"delay_seconds"`
	HeadwaySeconds float64 `json:"headway_seconds"`
	NextStopID     string  `json:"next_stop_id"`
	NextStopName   string  `json:"next_stop_name"`
	Status         string  `json:"status"`
}

// ScenarioFrame is a snapshot of time
type ScenarioFrame struct {
	Tick           int                    `json:"tick"`
	SimTimeSeconds int                    `json:"sim_time_seconds"`
	Vehicles       []ScenarioVehicleFrame `json:"vehicles"`
	Alert          *models.Alert          `json:"alert,omitempty"`
}

// ScenarioData is the root JSON structure
type ScenarioData struct {
	Route  ScenarioRoute   `json:"route"`
	Frames []ScenarioFrame `json:"frames"`
}

// Feeder controls playback of telemetry frames
type Feeder struct {
	mu             sync.RWMutex
	data           ScenarioData
	currentTick    int
	speed          float64
	isPlaying      bool
	holdingApplied bool
	listeners      []chan []byte
}

// LoadScenario reads scenario JSON from file paths
func LoadScenario(paths ...string) (*Feeder, error) {
	var fileBytes []byte
	var err error
	found := false

	for _, p := range paths {
		if b, e := os.ReadFile(p); e == nil {
			fileBytes = b
			found = true
			break
		}
	}

	if !found {
		return nil, fmt.Errorf("scenario file not found in paths: %v", paths)
	}

	var data ScenarioData
	if err = json.Unmarshal(fileBytes, &data); err != nil {
		return nil, fmt.Errorf("failed to unmarshal scenario: %w", err)
	}

	return &Feeder{
		data:           data,
		currentTick:    0,
		speed:          1.0,
		isPlaying:      true,
		holdingApplied: false,
		listeners:      make([]chan []byte, 0),
	}, nil
}

// GetRoute returns route info
func (f *Feeder) GetRoute() ScenarioRoute {
	f.mu.RLock()
	defer f.mu.RUnlock()
	return f.data.Route
}

// IsHoldingApplied returns holding status
func (f *Feeder) IsHoldingApplied() bool {
	f.mu.RLock()
	defer f.mu.RUnlock()
	return f.holdingApplied
}

// ApplyHolding toggles holding state
func (f *Feeder) ApplyHolding(applied bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.holdingApplied = applied
}

// SetSpeed updates playback multiplier
func (f *Feeder) SetSpeed(speed float64) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if speed <= 0 {
		speed = 1.0
	}
	f.speed = speed
}

// SetPlaying toggles playback
func (f *Feeder) SetPlaying(playing bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.isPlaying = playing
}

// Reset rewinds simulation to tick 0
func (f *Feeder) Reset() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.currentTick = 0
	f.holdingApplied = false
}

// GetState returns current vehicles and alert
func (f *Feeder) GetState() ([]models.Vehicle, *models.Alert, models.SystemStatus) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	if len(f.data.Frames) == 0 {
		return nil, nil, models.SystemStatus{}
	}

	frame := f.data.Frames[f.currentTick%len(f.data.Frames)]
	vehicles := make([]models.Vehicle, len(frame.Vehicles))

	for i, v := range frame.Vehicles {
		lat := v.Latitude
		lon := v.Longitude
		status := v.Status

		// If holding intervention was applied, use held trajectory for bus 1043
		if f.holdingApplied && v.ID == "1043" {
			if v.LatitudeHeld != 0 {
				lat = v.LatitudeHeld
				lon = v.LongitudeHeld
			}
			status = "ON_TIME"
		}

		vehicles[i] = models.Vehicle{
			ID:             v.ID,
			RouteID:        v.RouteID,
			TripID:         v.TripID,
			Latitude:       lat,
			Longitude:      lon,
			Bearing:        v.Bearing,
			SpeedKmH:       v.SpeedKmH,
			DelaySeconds:   v.DelaySeconds,
			HeadwaySeconds: v.HeadwaySeconds,
			NextStopID:     v.NextStopID,
			NextStopName:   v.NextStopName,
			Timestamp:      time.Now(),
			Status:         status,
		}
	}

	var alert *models.Alert
	if frame.Alert != nil {
		alertCopy := *frame.Alert
		if f.holdingApplied && alertCopy.Recommendation != nil {
			recCopy := *alertCopy.Recommendation
			recCopy.Applied = true
			alertCopy.Recommendation = &recCopy
			alertCopy.Severity = models.SeverityLow
			alertCopy.Probability = 0.08
			alertCopy.Message = "Рекомендация Holding применена: интервал стабилизируется"
		}
		alert = &alertCopy
	}

	status := models.SystemStatus{
		LiveSimulationActive: f.isPlaying,
		EngineLatencyMs:      3.2,
		ActiveVehiclesCount:  len(vehicles),
		ActiveAlertsCount:    0,
		PreventedIncidents:   19,
		PunctualityRate:      94.8,
		SimulationSpeed:      f.speed,
	}

	if alert != nil && !f.holdingApplied {
		status.ActiveAlertsCount = 1
	}
	if f.holdingApplied {
		status.PreventedIncidents = 20
		status.PunctualityRate = 98.2
	}

	return vehicles, alert, status
}

// AdvanceTick moves simulation one step forward
func (f *Feeder) AdvanceTick() {
	f.mu.Lock()
	defer f.mu.Unlock()
	if !f.isPlaying || len(f.data.Frames) == 0 {
		return
	}
	f.currentTick = (f.currentTick + 1) % len(f.data.Frames)
}

// GetSpeed returns current speed
func (f *Feeder) GetSpeed() float64 {
	f.mu.RLock()
	defer f.mu.RUnlock()
	return f.speed
}
