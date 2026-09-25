package main

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/mt-hack-predictor/backend/internal/models"
)

func main() {
	r := chi.NewRouter()

	// Base middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))

	// CORS setup for frontend dashboard
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:*", "http://127.0.0.1:*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Healthcheck
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status":    "healthy",
			"timestamp": time.Now().Format(time.RFC3339),
			"version":   "0.1.0",
		})
	})

	// API v1
	r.Route("/api/v1", func(r chi.Router) {
		// System status for Top Bar
		r.Get("/status", func(w http.ResponseWriter, r *http.Request) {
			status := models.SystemStatus{
				LiveSimulationActive: true,
				EngineLatencyMs:      3.8,
				ActiveVehiclesCount:  142,
				ActiveAlertsCount:    3,
				PreventedIncidents:   19,
				PunctualityRate:      94.8,
				SimulationSpeed:      1.0,
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(status)
		})

		// Vehicles list / live telemetry
		r.Get("/vehicles", func(w http.ResponseWriter, r *http.Request) {
			vehicles := []models.Vehicle{
				{
					ID:             "1042",
					RouteID:        "m3",
					TripID:         "trip_m3_101",
					Latitude:       55.7602,
					Longitude:      37.6698,
					Bearing:        125.0,
					SpeedKmH:       18.4,
					DelaySeconds:   720.0, // +12 min
					HeadwaySeconds: 120.0, // only 2 min to trailing bus!
					NextStopID:     "stop_baumanskaya",
					NextStopName:   "м. Бауманская",
					Timestamp:      time.Now(),
					Status:         "BUNCHING_RISK",
				},
				{
					ID:             "1043",
					RouteID:        "m3",
					TripID:         "trip_m3_102",
					Latitude:       55.7631,
					Longitude:      37.6620,
					Bearing:        122.0,
					SpeedKmH:       24.0,
					DelaySeconds:   30.0,
					HeadwaySeconds: 120.0,
					NextStopID:     "stop_baumanskaya",
					NextStopName:   "м. Бауманская",
					Timestamp:      time.Now(),
					Status:         "ON_TIME",
				},
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(vehicles)
		})

		// Predictive radar alerts
		r.Get("/alerts", func(w http.ResponseWriter, r *http.Request) {
			alerts := []models.Alert{
				{
					ID:            "alert_001",
					VehicleID:     "1042",
					RouteID:       "m3",
					Type:          "BUS_BUNCHING",
					Severity:      models.SeverityCritical,
					Probability:   0.89,
					EstimatedTime: 22 * time.Minute,
					Message:       "Риск схлопывания интервала с бортом №1043 на перегоне ст.м. Бауманская",
					CreatedAt:     time.Now(),
					Factors: []models.SHAPFactor{
						{Feature: "traffic_congestion", Title: "Затор на Бауманской ул.", Weight: 65.0, ImpactScore: 0.65},
						{Feature: "weather_precipitation", Title: "Задержка посадки (осадки)", Weight: 25.0, ImpactScore: 0.25},
						{Feature: "traffic_light_cycle", Title: "Светофорный цикл ТТК", Weight: 10.0, ImpactScore: 0.10},
					},
					Recommendation: &models.Recommendation{
						ActionType:      "HOLDING",
						TargetVehicleID: "1043",
						HoldStopID:      "stop_baumanskaya",
						HoldStopName:    "м. Бауманская",
						DurationSeconds: 150,
						PredictedImpact: "Выравнивание интервала: устранение пачкования и восстановление 8-минутного такта",
						Applied:         false,
					},
				},
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(alerts)
		})

		// Apply recommendation
		r.Post("/recommendations/{id}/apply", func(w http.ResponseWriter, r *http.Request) {
			recID := chi.URLParam(r, "id")
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]any{
				"status":          "applied",
				"recommendation":  recID,
				"dispatched_to":   "АСУ-РДС / Бортовой терминал",
				"timestamp":       time.Now().Format(time.RFC3339),
			})
		})
	})

	port := ":8080"
	log.Printf("🚀 MT-Predictor Go Backend running on http://localhost%s", port)
	if err := http.ListenAndServe(port, r); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
