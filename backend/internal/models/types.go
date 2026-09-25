package models

import "time"

// Severity defines alert level
type Severity string

const (
	SeverityLow      Severity = "LOW"
	SeverityMedium   Severity = "MEDIUM"
	SeverityHigh     Severity = "HIGH"
	SeverityCritical Severity = "CRITICAL"
)

// Vehicle represents live vehicle state in telemetry
type Vehicle struct {
	ID             string    `json:"id"`
	RouteID        string    `json:"route_id"`
	TripID         string    `json:"trip_id"`
	Latitude       float64   `json:"latitude"`
	Longitude      float64   `json:"longitude"`
	Bearing        float64   `json:"bearing"` // Degrees
	SpeedKmH       float64   `json:"speed_kmh"`
	DelaySeconds   float64   `json:"delay_seconds"`   // Positive = late, negative = early
	HeadwaySeconds float64   `json:"headway_seconds"` // Delta time to preceding vehicle
	NextStopID     string    `json:"next_stop_id"`
	NextStopName   string    `json:"next_stop_name"`
	Timestamp      time.Time `json:"timestamp"`
	Status         string    `json:"status"` // "ON_TIME", "DELAYED", "BUNCHING_RISK"
}

// Alert represents proactive warning for dispatchers
type Alert struct {
	ID              string          `json:"id"`
	VehicleID       string          `json:"vehicle_id"`
	RouteID         string          `json:"route_id"`
	Type            string          `json:"type"` // "BUS_BUNCHING", "SEVERE_DELAY", "HEADWAY_COLLAPSE"
	Severity        Severity        `json:"severity"`
	Probability     float64         `json:"probability"` // 0.0 - 1.0 (from ML classification)
	EstimatedTime   time.Duration   `json:"estimated_time_to_incident"` // e.g., 20 minutes
	Message         string          `json:"message"`
	Factors         []SHAPFactor    `json:"factors"`
	Recommendation  *Recommendation `json:"recommendation,omitempty"`
	CreatedAt       time.Time       `json:"created_at"`
}

// SHAPFactor explains ML decision (Explainable AI / XAI)
type SHAPFactor struct {
	Feature     string  `json:"feature"`     // e.g., "traffic_jam_segment_42", "weather_rain"
	Title       string  `json:"title"`       // e.g., "Затор на ул. Бауманская"
	Weight      float64 `json:"weight"`      // Contribution percentage (0 - 100)
	ImpactScore float64 `json:"impact_score"`// SHAP value
}

// Recommendation represents actionable intervention suggested by Decision Support System
type Recommendation struct {
	ActionType      string  `json:"action_type"` // "HOLDING", "SPEED_ADJUST", "SHORT_TURN"
	TargetVehicleID string  `json:"target_vehicle_id"`
	HoldStopID      string  `json:"hold_stop_id"`
	HoldStopName    string  `json:"hold_stop_name"`
	DurationSeconds int     `json:"duration_seconds"` // e.g. 150 seconds (2.5 min)
	PredictedImpact string  `json:"predicted_impact"` // e.g. "Восстановление интервала с 1.2 мин до 7.5 мин"
	Applied         bool    `json:"applied"`
}

// SystemStatus provides high-level metrics for dashboard Top Bar
type SystemStatus struct {
	LiveSimulationActive bool    `json:"live_simulation_active"`
	EngineLatencyMs      float64 `json:"engine_latency_ms"`
	ActiveVehiclesCount  int     `json:"active_vehicles_count"`
	ActiveAlertsCount    int     `json:"active_alerts_count"`
	PreventedIncidents   int     `json:"prevented_incidents_count"`
	PunctualityRate      float64 `json:"punctuality_rate"` // e.g. 94.8%
	SimulationSpeed      float64 `json:"simulation_speed"` // 1.0x, 5.0x
}
