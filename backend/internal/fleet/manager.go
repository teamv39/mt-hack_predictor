package fleet

import (
	"fmt"
	"sync"
	"time"

	"github.com/mt-hack-predictor/backend/internal/models"
	"github.com/mt-hack-predictor/backend/internal/ndtp"
)

// Manager holds live vehicle state from NDTP (and optional ML overlays).
type Manager struct {
	mu       sync.RWMutex
	vehicles map[string]*models.Vehicle // key = vehicle id (unitId string by default)
}

// NewManager creates an empty fleet cache.
func NewManager() *Manager {
	return &Manager{
		vehicles: make(map[string]*models.Vehicle),
	}
}

// UpsertNav applies a navigation cell from NDTP into the fleet cache.
func (m *Manager) UpsertNav(nav ndtp.NavCell) *models.Vehicle {
	id := fmt.Sprintf("%d", nav.UnitID)
	m.mu.Lock()
	defer m.mu.Unlock()

	v, ok := m.vehicles[id]
	if !ok {
		v = &models.Vehicle{
			ID:      id,
			RouteID: "ndtp-live",
			Status:  "ON_TIME",
		}
		m.vehicles[id] = v
	}

	v.Latitude = nav.Latitude
	v.Longitude = nav.Longitude
	v.Bearing = nav.Course
	v.SpeedKmH = nav.SpeedKmh
	v.Timestamp = nav.Timestamp
	if v.Timestamp.IsZero() {
		v.Timestamp = time.Now().UTC()
	}

	// Without schedule matching we keep delay as last known / ML-updated value.
	v.Status = statusFromDelay(v.DelaySeconds, v.HeadwaySeconds)
	cp := *v
	return &cp
}

// SetPrediction overlays ML delay / headway risk onto a vehicle.
func (m *Manager) SetPrediction(vehicleID string, delaySec float64, bunchingRisk float64, headwaySec float64) {
	m.mu.Lock()
	defer m.mu.Unlock()
	v, ok := m.vehicles[vehicleID]
	if !ok {
		return
	}
	v.DelaySeconds = delaySec
	if headwaySec > 0 {
		v.HeadwaySeconds = headwaySec
	}
	if bunchingRisk >= 0.7 {
		v.Status = "BUNCHING_RISK"
	} else {
		v.Status = statusFromDelay(delaySec, v.HeadwaySeconds)
	}
}

// Get returns a copy of one vehicle.
func (m *Manager) Get(id string) (models.Vehicle, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	v, ok := m.vehicles[id]
	if !ok {
		return models.Vehicle{}, false
	}
	return *v, true
}

// List returns copies of all live NDTP vehicles.
func (m *Manager) List() []models.Vehicle {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]models.Vehicle, 0, len(m.vehicles))
	for _, v := range m.vehicles {
		out = append(out, *v)
	}
	return out
}

// Count returns number of tracked units.
func (m *Manager) Count() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.vehicles)
}

// MergeDemo puts demo feeder vehicles first, then overlays/appends live NDTP units
// that are not already represented (by id).
func (m *Manager) MergeDemo(demo []models.Vehicle) []models.Vehicle {
	m.mu.RLock()
	defer m.mu.RUnlock()

	seen := make(map[string]struct{}, len(demo)+len(m.vehicles))
	out := make([]models.Vehicle, 0, len(demo)+len(m.vehicles))
	for _, v := range demo {
		out = append(out, v)
		seen[v.ID] = struct{}{}
	}
	for id, v := range m.vehicles {
		if _, ok := seen[id]; ok {
			continue
		}
		out = append(out, *v)
	}
	return out
}

func statusFromDelay(delaySec, headwaySec float64) string {
	if headwaySec > 0 && headwaySec < 90 {
		return "BUNCHING_RISK"
	}
	if delaySec > 180 {
		return "DELAYED"
	}
	if delaySec > 60 {
		return "DELAYED"
	}
	return "ON_TIME"
}
