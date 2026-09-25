package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/mt-hack-predictor/backend/internal/api"
	"github.com/mt-hack-predictor/backend/internal/engine"
	"github.com/mt-hack-predictor/backend/internal/feeder"
	"github.com/mt-hack-predictor/backend/internal/fleet"
	"github.com/mt-hack-predictor/backend/internal/mlclient"
	"github.com/mt-hack-predictor/backend/internal/models"
	"github.com/mt-hack-predictor/backend/internal/ndtp"
	"github.com/mt-hack-predictor/backend/internal/schedule"
	"github.com/mt-hack-predictor/backend/internal/telemetry"
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

func computePunctuality(vehicles []models.Vehicle) float64 {
	if len(vehicles) == 0 {
		return 100.0
	}
	onTime := 0
	for _, v := range vehicles {
		if v.Status == "ON_TIME" || v.Status == "REGULATING" {
			onTime++
		}
	}
	return (float64(onTime) / float64(len(vehicles))) * 100.0
}

func main() {
	// Root context for background servers
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 1. Initialize Fleet Manager (In-Memory Telemetry Cache)
	fleetMgr := fleet.NewManager()

	// 2. Initialize Telemetry Tracker (Sliding window dynamics)
	tracker := telemetry.NewTracker(15 * time.Minute)

	// 3. Initialize Schedule Matcher (Spatial & Timetable lookup)
	schedMatcher := schedule.NewMatcher()
	schedCandidates := []string{
		"dataset/validate/schedule_plan.csv",
		"dataset/train/schedule.csv",
		"../dataset/validate/schedule_plan.csv",
		"../../dataset/validate/schedule_plan.csv",
		"/app/dataset/validate/schedule_plan.csv",
	}
	for _, p := range schedCandidates {
		if n, err := schedMatcher.LoadFromCSV(p); err == nil && n > 0 {
			log.Printf("✅ Loaded %d timetable stops into ScheduleMatcher from %s", n, p)
			break
		}
	}

	// 4. Initialize Headway & Alert Engines
	headwayCalc := engine.NewHeadwayCalculator(480.0) // 8 min nominal headway
	alertMgr := engine.NewAlertManager()

	// 5. Initialize ML Client (HTTP connection to Python FastAPI)
	mlURL := os.Getenv("ML_SERVICE_URL")
	if mlURL == "" {
		mlURL = "http://localhost:8000"
	}
	mlCli := mlclient.New(mlURL)
	log.Printf("🤖 Connected to ML service at %s", mlURL)

	// 6. Initialize NDTP Ingestion Server (:9201)
	ndtpPort := os.Getenv("NDTP_PORT")
	if ndtpPort == "" {
		ndtpPort = ":9201"
	}
	if !strings.HasPrefix(ndtpPort, ":") {
		ndtpPort = ":" + ndtpPort
	}

	ndtpSrv := ndtp.NewServer(ndtpPort, func(nav ndtp.NavCell) {
		v := fleetMgr.UpsertNav(nav)

		// 1. Record point in telemetry tracker
		tracker.AddPoint(v.ID, telemetry.Point{
			Timestamp: v.Timestamp,
			Latitude:  nav.Latitude,
			Longitude: nav.Longitude,
			SpeedKmh:  nav.SpeedKmh,
			Bearing:   nav.Course,
		})

		// 2. Match with timetable schedule
		match := schedMatcher.MatchVehicle(v.ID, nav.Latitude, nav.Longitude, v.Timestamp)
		if match.Matched {
			fleetMgr.UpdateStopInfo(v.ID, match.StopID, match.StopName, match.CurDevSeconds)
			v.NextStopID = match.StopID
			v.NextStopName = match.StopName
			v.DelaySeconds = match.CurDevSeconds
		}

		// 3. Compute derived rolling telemetry features
		feat := tracker.ComputeFeatures(v.ID, v.Timestamp)

		// 4. Dynamic fleet headway assessment
		allLive := fleetMgr.List()
		headwayMap := headwayCalc.AssessFleetHeadways(allLive)
		hwInfo, hasHw := headwayMap[v.ID]
		headwaySec := 480.0
		if hasHw {
			headwaySec = hwInfo.HeadwaySec
		}

		// 5. Asynchronous ML prediction & DSS Alert evaluation
		go func(veh models.Vehicle, curDev float64, avgSpeed float64, hwSec float64, hw engine.HeadwayInfo, horizonSec float64) {
			predCtx, predCancel := context.WithTimeout(context.Background(), 250*time.Millisecond)
			defer predCancel()

			pred := mlCli.PredictEnriched(predCtx, veh, curDev, avgSpeed, hwSec)

			fleetMgr.SetPrediction(veh.ID, pred.PredictedDelaySec, pred.BunchingRiskProbability, hwSec)

			// Convert SHAP factors
			shapFactors := make([]models.SHAPFactor, 0, len(pred.Factors))
			for _, f := range pred.Factors {
				shapFactors = append(shapFactors, models.SHAPFactor{
					Feature:     f.Feature,
					Title:       f.Title,
					Weight:      f.Weight,
					ImpactScore: f.ImpactScore,
				})
			}

			// Update alert state in DSS AlertManager
			veh.DelaySeconds = pred.PredictedDelaySec
			alertMgr.UpsertVehicleAlert(veh, hw, shapFactors, horizonSec)
		}(*v, match.CurDevSeconds, feat.AvgSpeed3m, headwaySec, hwInfo, match.HorizonSeconds)
	})

	go func() {
		if err := ndtpSrv.Start(ctx); err != nil {
			log.Printf("⚠️ NDTP Server stopped: %v", err)
		}
	}()

	// 7. Initialize Feeder (Mock / Replay Scenario)
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

	// 8. Initialize WebSocket Hub
	hub := ws.NewHub()
	go hub.Run()

	// 9. Broadcast loop (1 Hz)
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

			// Merge live DSS alerts
			liveAlerts := alertMgr.GetAll()
			if len(liveAlerts) > 0 {
				alert = &liveAlerts[0]
			}

			status.ActiveVehiclesCount = len(allVehicles)
			status.ActiveAlertsCount = len(liveAlerts)
			if f != nil {
				_, scAlert, _ := f.GetState()
				if scAlert != nil && len(liveAlerts) == 0 {
					alert = scAlert
					status.ActiveAlertsCount++
				}
			}
			status.PreventedIncidents = alertMgr.PreventedCount()
			status.PunctualityRate = computePunctuality(allVehicles)

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
		liveAlerts := alertMgr.GetAll()

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
			"engine": map[string]any{
				"schedule_stops":      schedMatcher.StopsCount(),
				"active_alerts":       len(liveAlerts),
				"prevented_incidents": alertMgr.PreventedCount(),
				"tracked_vehicles":    fleetMgr.Count(),
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
			var demoVehicles []models.Vehicle
			if f != nil {
				vehicles, _, st := f.GetState()
				demoVehicles = vehicles
				status = st
			}
			allVehicles := fleetMgr.MergeDemo(demoVehicles)
			liveAlerts := alertMgr.GetAll()

			status.ActiveVehiclesCount = len(allVehicles)
			status.ActiveAlertsCount = len(liveAlerts)
			if f != nil {
				_, scAlert, _ := f.GetState()
				if scAlert != nil {
					status.ActiveAlertsCount++
				}
			}
			status.PreventedIncidents = alertMgr.PreventedCount()
			status.PunctualityRate = computePunctuality(allVehicles)

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
			alerts := alertMgr.GetAll()
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

			targetVeh, holdSec, applied := alertMgr.ApplyRecommendation(recID)
			if applied {
				fleetMgr.ApplyHolding(targetVeh, holdSec)
				log.Printf("🎯 Applied Holding via DSS: vehicle=%s, duration=%d sec", targetVeh, holdSec)
			}

			if f != nil {
				f.ApplyHolding(true)
			}

			// Immediate broadcast of updated state
			var demoVehicles []models.Vehicle
			var alert *models.Alert
			var status models.SystemStatus
			if f != nil {
				demoVehicles, alert, status = f.GetState()
			}
			allVehicles := fleetMgr.MergeDemo(demoVehicles)
			liveAlerts := alertMgr.GetAll()
			if len(liveAlerts) > 0 {
				alert = &liveAlerts[0]
			}

			status.ActiveVehiclesCount = len(allVehicles)
			status.ActiveAlertsCount = len(liveAlerts)
			status.PreventedIncidents = alertMgr.PreventedCount()
			status.PunctualityRate = computePunctuality(allVehicles)

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
				"target_vehicle": targetVeh,
				"duration_sec":   holdSec,
				"dispatched_to":  fmt.Sprintf("АСУ-РДС / Бортовой терминал борта №%s", targetVeh),
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

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{
				"status": "ok",
				"action": req.Action,
			})
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	serverAddr := ":" + port

	log.Printf("🚀 Starting Situational Predictor Go Server on %s", serverAddr)
	log.Printf("📡 NDTP TCP Telemetry Ingestion Receiver on %s", ndtpPort)
	log.Printf("📖 Swagger UI Documentation on http://localhost:%s/swagger", port)

	srv := &http.Server{
		Addr:         serverAddr,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server failed: %v", err)
	}
}
