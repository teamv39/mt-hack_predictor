package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/mt-hack-predictor/backend/internal/api"
	"github.com/mt-hack-predictor/backend/internal/feeder"
	"github.com/mt-hack-predictor/backend/internal/fleet"
	"github.com/mt-hack-predictor/backend/internal/mlclient"
	"github.com/mt-hack-predictor/backend/internal/models"
	"github.com/mt-hack-predictor/backend/internal/ndtp"
	"github.com/mt-hack-predictor/backend/internal/ws"
)

type SimulationControlRequest struct {
	Action string  `json:"action"` // "play", "pause", "speed", "reset"
	Speed  float64 `json:"speed,omitempty"`
}

type TelemetryWSMessage struct {
	Type      string              `json:"type"` // "TELEMETRY_UPDATE"
	Status    models.SystemStatus `json:"status"`
	Vehicles  []models.Vehicle    `json:"vehicles"`
	Alert     *models.Alert       `json:"alert,omitempty"`
	Timestamp string              `json:"timestamp"`
}

func main() {
	// Root context for background servers
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 1. Initialize Fleet Manager (In-Memory Telemetry Cache)
	fleetMgr := fleet.NewManager()

	// 2. Initialize ML Client (HTTP connection to Python FastAPI)
	mlURL := os.Getenv("ML_SERVICE_URL")
	if mlURL == "" {
		mlURL = "http://localhost:8000"
	}
	mlCli := mlclient.New(mlURL)
	log.Printf("🤖 Connected to ML service at %s", mlURL)

	// 3. Initialize NDTP Ingestion Server (:9201)
	ndtpPort := os.Getenv("NDTP_PORT")
	if ndtpPort == "" {
		ndtpPort = ":9201"
	}
	if !strings.HasPrefix(ndtpPort, ":") {
		ndtpPort = ":" + ndtpPort
	}

	ndtpSrv := ndtp.NewServer(ndtpPort, func(nav ndtp.NavCell) {
		v := fleetMgr.UpsertNav(nav)
		// Asynchronous ML prediction call
		go func(veh models.Vehicle) {
			predCtx, predCancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
			defer predCancel()
			pred := mlCli.PredictForVehicle(predCtx, veh)
			fleetMgr.SetPrediction(veh.ID, pred.PredictedDelaySec, pred.BunchingRiskProbability, 0)
		}(*v)
	})

	go func() {
		if err := ndtpSrv.Start(ctx); err != nil {
			log.Printf("⚠️ NDTP Server stopped: %v", err)
		}
	}()

	// 4. Initialize Feeder (Mock / Replay Scenario)
	f, err := feeder.LoadScenario(
		"data/sample/m3_scenario.json",
		"../../data/sample/m3_scenario.json",
		"../data/sample/m3_scenario.json",
	)
	if err != nil {
		log.Printf("⚠️ Scenario file not found, running with NDTP only: %v", err)
	} else {
		log.Println("✅ Loaded m3 route scenario successfully")
	}

	// 5. Initialize WebSocket Hub
	hub := ws.NewHub()
	go hub.Run()

	// 6. Broadcast loop
	go func() {
		for {
			speed := 1.0
			if f != nil {
				speed = f.GetSpeed()
			}
			interval := time.Duration(float64(time.Second) / speed)
			time.Sleep(interval)

			var vehicles []models.Vehicle
			var alert *models.Alert
			var status models.SystemStatus

			if f != nil {
				f.AdvanceTick()
				vehicles, alert, status = f.GetState()
			}

			// Merge live NDTP units with scenario vehicles
			allVehicles := fleetMgr.MergeDemo(vehicles)
			status.ActiveVehiclesCount = len(allVehicles)

			msg := TelemetryWSMessage{
				Type:      "TELEMETRY_UPDATE",
				Status:    status,
				Vehicles:  allVehicles,
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

	// Mount Swagger UI & OpenAPI Specification
	api.RegisterSwagger(r)

	// Healthcheck
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		running, accepts, packets, conns := ndtpSrv.Stats()
		mlOk, mlFb := mlCli.Stats()

		json.NewEncoder(w).Encode(map[string]any{
			"status":    "healthy",
			"timestamp": time.Now().Format(time.RFC3339),
			"version":   "0.3.0",
			"ndtp": map[string]any{
				"running":      running,
				"active_conns": conns,
				"accepts":      accepts,
				"packets":      packets,
				"port":         ndtpPort,
			},
			"ml_client": map[string]any{
				"ok_requests":       mlOk,
				"fallback_requests": mlFb,
				"url":               mlURL,
			},
		})
	})

	// WebSocket stream
	r.Get("/ws", hub.HandleWebSocket)

	// API v1
	r.Route("/api/v1", func(r chi.Router) {
		// Route metadata & geometry
		r.Get("/route", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			if f != nil {
				json.NewEncoder(w).Encode(f.GetRoute())
			} else {
				json.NewEncoder(w).Encode(map[string]string{"route_id": "m3"})
			}
		})

		// System status
		r.Get("/status", func(w http.ResponseWriter, r *http.Request) {
			var status models.SystemStatus
			if f != nil {
				_, _, status = f.GetState()
			}
			allVehicles := fleetMgr.MergeDemo(nil)
			if f != nil {
				vehicles, _, _ := f.GetState()
				allVehicles = fleetMgr.MergeDemo(vehicles)
			}
			status.ActiveVehiclesCount = len(allVehicles)
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(status)
		})

		// Vehicles list (demo + live NDTP)
		r.Get("/vehicles", func(w http.ResponseWriter, r *http.Request) {
			var demoVehicles []models.Vehicle
			if f != nil {
				demoVehicles, _, _ = f.GetState()
			}
			allVehicles := fleetMgr.MergeDemo(demoVehicles)
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(allVehicles)
		})

		// Alerts list
		r.Get("/alerts", func(w http.ResponseWriter, r *http.Request) {
			alerts := []models.Alert{}
			if f != nil {
				_, alert, _ := f.GetState()
				if alert != nil {
					alerts = append(alerts, *alert)
				}
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(alerts)
		})

		// Apply holding recommendation
		r.Post("/recommendations/{id}/apply", func(w http.ResponseWriter, r *http.Request) {
			recID := chi.URLParam(r, "id")
			if f != nil {
				f.ApplyHolding(true)
			}

			// Immediate broadcast of updated state
			var vehicles []models.Vehicle
			var alert *models.Alert
			var status models.SystemStatus
			if f != nil {
				vehicles, alert, status = f.GetState()
			}
			allVehicles := fleetMgr.MergeDemo(vehicles)
			status.ActiveVehiclesCount = len(allVehicles)

			msg := TelemetryWSMessage{
				Type:      "HOLDING_APPLIED",
				Status:    status,
				Vehicles:  allVehicles,
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

			if f != nil {
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
			}

			currentSpeed := 1.0
			if f != nil {
				currentSpeed = f.GetSpeed()
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]any{
				"status": "updated",
				"action": req.Action,
				"speed":  currentSpeed,
			})
		})

		// NDTP & Ingestion Telemetry Stats
		r.Get("/ndtp/stats", func(w http.ResponseWriter, r *http.Request) {
			running, accepts, packets, conns := ndtpSrv.Stats()
			mlOk, mlFb := mlCli.Stats()
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]any{
				"ndtp_listener": map[string]any{
					"running":            running,
					"port":               ndtpPort,
					"active_connections": conns,
					"total_accepted":     accepts,
					"packets_processed":  packets,
					"live_units_count":   fleetMgr.Count(),
				},
				"ml_pipeline": map[string]any{
					"url":               mlURL,
					"successful_calls":  mlOk,
					"fallback_calls":    mlFb,
					"graceful_fallback": true,
				},
			})
		})
	})

	httpPort := os.Getenv("PORT")
	if httpPort == "" {
		httpPort = "8080"
	}
	if !strings.HasPrefix(httpPort, ":") {
		httpPort = ":" + httpPort
	}

	log.Printf("🚀 MT-Predictor Go Backend running on http://localhost%s", httpPort)
	log.Printf("📡 Swagger UI available on http://localhost%s/swagger", httpPort)
	log.Printf("📡 NDTP TCP Listener active on port %s", ndtpPort)

	server := &http.Server{
		Addr:    httpPort,
		Handler: r,
	}

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server failed: %v", err)
	}
}
