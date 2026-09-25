package main

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/mt-hack-predictor/backend/internal/feeder"
	"github.com/mt-hack-predictor/backend/internal/models"
	"github.com/mt-hack-predictor/backend/internal/ws"
)

type SimulationControlRequest struct {
	Action string  `json:"action"` // "play", "pause", "speed", "reset"
	Speed  float64 `json:"speed,omitempty"`
}

type TelemetryWSMessage struct {
	Type      string               `json:"type"` // "TELEMETRY_UPDATE"
	Status    models.SystemStatus  `json:"status"`
	Vehicles  []models.Vehicle     `json:"vehicles"`
	Alert     *models.Alert        `json:"alert,omitempty"`
	Timestamp string               `json:"timestamp"`
}

func main() {
	// Initialize Feeder
	f, err := feeder.LoadScenario(
		"data/sample/m3_scenario.json",
		"../../data/sample/m3_scenario.json",
		"../data/sample/m3_scenario.json",
	)
	if err != nil {
		log.Fatalf("❌ Failed to load m3 scenario: %v", err)
	}
	log.Println("✅ Loaded m3 route scenario successfully")

	// Initialize WebSocket Hub
	hub := ws.NewHub()
	go hub.Run()

	// Broadcast loop
	go func() {
		for {
			speed := f.GetSpeed()
			interval := time.Duration(float64(time.Second) / speed)
			time.Sleep(interval)

			f.AdvanceTick()
			vehicles, alert, status := f.GetState()

			msg := TelemetryWSMessage{
				Type:      "TELEMETRY_UPDATE",
				Status:    status,
				Vehicles:  vehicles,
				Alert:     alert,
				Timestamp: time.Now().Format(time.RFC3339),
			}

			if data, err := json.Marshal(msg); err == nil {
				hub.Broadcast(data)
			}
		}
	}()

	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))

	// CORS setup
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: false,
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

	// WebSocket stream
	r.Get("/ws", hub.HandleWebSocket)

	// API v1
	r.Route("/api/v1", func(r chi.Router) {
		// Route metadata & geometry
		r.Get("/route", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(f.GetRoute())
		})

		// System status
		r.Get("/status", func(w http.ResponseWriter, r *http.Request) {
			_, _, status := f.GetState()
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(status)
		})

		// Vehicles list
		r.Get("/vehicles", func(w http.ResponseWriter, r *http.Request) {
			vehicles, _, _ := f.GetState()
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(vehicles)
		})

		// Alerts list
		r.Get("/alerts", func(w http.ResponseWriter, r *http.Request) {
			_, alert, _ := f.GetState()
			alerts := []models.Alert{}
			if alert != nil {
				alerts = append(alerts, *alert)
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(alerts)
		})

		// Apply holding recommendation
		r.Post("/recommendations/{id}/apply", func(w http.ResponseWriter, r *http.Request) {
			recID := chi.URLParam(r, "id")
			f.ApplyHolding(true)

			// Immediate broadcast of updated state
			vehicles, alert, status := f.GetState()
			msg := TelemetryWSMessage{
				Type:      "HOLDING_APPLIED",
				Status:    status,
				Vehicles:  vehicles,
				Alert:     alert,
				Timestamp: time.Now().Format(time.RFC3339),
			}
			if data, err := json.Marshal(msg); err == nil {
				hub.Broadcast(data)
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]any{
				"status":         "applied",
				"recommendation": recID,
				"holding_active": true,
				"dispatched_to":  "АСУ-РДС / Бортовой терминал борта №1043",
				"timestamp":      time.Now().Format(time.RFC3339),
			})
		})

		// Simulation control (play/pause/speed/reset)
		r.Post("/simulation/control", func(w http.ResponseWriter, r *http.Request) {
			var req SimulationControlRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}

			switch req.Action {
			case "play":
				f.SetPlaying(true)
			case "pause":
				f.SetPlaying(false)
			case "speed":
				if req.Speed > 0 {
					f.SetSpeed(req.Speed)
				}
			case "reset":
				f.Reset()
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]any{
				"status": "updated",
				"action": req.Action,
				"speed":  f.GetSpeed(),
			})
		})
	})

	port := ":8080"
	log.Printf("🚀 MT-Predictor Go Backend running on http://localhost%s", port)
	if err := http.ListenAndServe(port, r); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
