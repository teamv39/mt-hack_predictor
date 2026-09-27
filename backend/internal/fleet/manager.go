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
	mu           sync.RWMutex
	vehicles     map[string]*models.Vehicle // key = vehicle id (unitId string by default)
	holdingUntil map[string]time.Time       // vehicle id -> active holding expiration
}

// NewManager creates an empty fleet cache.
func NewManager() *Manager {
	return &Manager{
		vehicles:     make(map[string]*models.Vehicle),
		holdingUntil: make(map[string]time.Time),
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

	// Update status respecting active holding regulation
	v.Status = m.computeStatus(id, v.DelaySeconds, v.HeadwaySeconds)
	cp := *v
	return &cp
}

// UpdateStopInfo updates target stop metadata and calculated schedule delay.
func (m *Manager) UpdateStopInfo(vehicleID string, stopID, stopName string, delaySec float64) {
	m.mu.Lock()
	defer m.mu.Unlock()

	v, ok := m.vehicles[vehicleID]
	if !ok {
		return
	}
	if stopID != "" {
		v.NextStopID = stopID
	}
	if stopName != "" {
		v.NextStopName = stopName
	}
	v.DelaySeconds = delaySec
	v.Status = m.computeStatus(vehicleID, delaySec, v.HeadwaySeconds)
}

// ApplyHolding puts vehicle in REGULATING state for a given duration.
func (m *Manager) ApplyHolding(vehicleID string, durationSec int) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if durationSec <= 0 {
		durationSec = 150
	}
	m.holdingUntil[vehicleID] = time.Now().Add(time.Duration(durationSec) * time.Second)

	if v, ok := m.vehicles[vehicleID]; ok {
		v.Status = "REGULATING"
	}
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
		if !m.isHoldingActiveLocked(vehicleID) {
			v.Status = "BUNCHING_RISK"
		}
	} else {
		v.Status = m.computeStatus(vehicleID, delaySec, v.HeadwaySeconds)
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

func (m *Manager) isHoldingActiveLocked(vehicleID string) bool {
	exp, ok := m.holdingUntil[vehicleID]
	if !ok {
		return false
	}
	if time.Now().Before(exp) {
		return true
	}
	delete(m.holdingUntil, vehicleID)
	return false
}

func (m *Manager) computeStatus(vehicleID string, delaySec, headwaySec float64) string {
	if m.isHoldingActiveLocked(vehicleID) {
		return "REGULATING"
	}
	if headwaySec > 0 && headwaySec < 180 {
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
