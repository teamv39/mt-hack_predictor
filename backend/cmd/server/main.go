package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
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
	Action string  `json:"action"` // "play", "pause", "speed", "reset", "set_mode"
	Speed  float64 `json:"speed,omitempty"`
	Mode   string  `json:"mode,omitempty"` // "gps", "scenario"
}

type TelemetryWSMessage struct {
	Type      string              `json:"type"` // "TELEMETRY_UPDATE"
	Status    models.SystemStatus `json:"status"`
	Vehicles  []models.Vehicle    `json:"vehicles"`
	Alert     *models.Alert       `json:"alert,omitempty"`
	Timestamp string              `json:"timestamp"`
	SimTime   string              `json:"sim_time,omitempty"`
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
			log.Printf("[INFO] Loaded %d timetable stops into ScheduleMatcher from %s", n, p)
			break
		}
	}

	// Load historical GPS tracks before accepting HTTP requests.
	trackStore := api.NewTrackStore()
	trackCandidates := []string{
		"dataset/train/traffic.csv",
		"../dataset/train/traffic.csv",
		"../../dataset/train/traffic.csv",
		"/app/dataset/train/traffic.csv",
	}
	if path := os.Getenv("TRACKS_CSV_PATH"); path != "" {
		trackCandidates = append([]string{path}, trackCandidates...)
	}
	var trackErr error
	for _, path := range trackCandidates {
		var count int
		count, trackErr = trackStore.LoadFromCSV(path)
		if trackErr == nil {
			log.Printf("[INFO] Loaded %d GPS points in %d tracks from %s", count, trackStore.TrackCount(), path)
			break
		}
	}
	if trackErr != nil {
		log.Printf("[WARN] Could not load GPS tracks: %v", trackErr)
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
	log.Printf("[INFO] Connected to ML service at %s", mlURL)

	// 6. Initialize NDTP Emulator Controller (:18080)
	targetHost := os.Getenv("NDTP_HOST_FOR_EMULATOR")
	if targetHost == "" {
		if _, err := os.Stat("/.dockerenv"); err == nil {
			targetHost = "backend"
		} else {
			targetHost = "host.docker.internal"
		}
	}

	ndtpEmuURL := os.Getenv("NDTP_EMULATOR_URL")
	if ndtpEmuURL == "" {
		if _, err := os.Stat("/.dockerenv"); err == nil {
			ndtpEmuURL = "http://ndtp-emu:18080"
		} else {
			ndtpEmuURL = "http://localhost:18080"
		}
	}
	ndtpCli := ndtp.NewEmulatorClient(ndtpEmuURL)

	// 6.1. Automated background bootstrap of NDTP emulation
	autoStartNDTP := os.Getenv("AUTO_START_NDTP")
	if autoStartNDTP != "false" {
		go func() {
			log.Printf("[INFO] NDTP auto-start watcher started (target=%s:9201, emu=%s)", targetHost, ndtpEmuURL)
			// Poll emulator API for up to 30 seconds
			for i := 0; i < 15; i++ {
				select {
				case <-ctx.Done():
					return
				case <-time.After(2 * time.Second):
				}

				pollCtx, pollCancel := context.WithTimeout(ctx, 2*time.Second)
				err := ndtpCli.StartEmulation(pollCtx, targetHost, 9201, []int64{1166336, 122658, 131672}, 3000)
				if err != nil {
					// Also attempt localhost if host.docker.internal failed
					_ = ndtpCli.StartEmulation(pollCtx, "localhost", 9201, []int64{1166336, 122658, 131672}, 3000)
				}
				pollCancel()

				if err == nil {
					log.Printf("[INFO] NDTP Emulation automatically bootstrapped with units [1166336, 122658, 131672]")
					break
				}
			}
		}()
	}

	// 7. Initialize NDTP Ingestion Server (:9201)
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
		go func(veh models.Vehicle, feat telemetry.Features, match schedule.MatchResult, hwSec float64, hw engine.HeadwayInfo) {
			predCtx, predCancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer predCancel()

			pred := mlCli.PredictEnriched(predCtx, veh, match.CurDevSeconds, feat.AvgSpeed3m, hwSec, mlclient.EnrichedFeatures{
				CurDevSec:      match.CurDevSeconds,
				AvgSpeed:       feat.AvgSpeed3m,
				HeadwaySec:     hwSec,
				AvgSpeed3m:     feat.AvgSpeed3m,
				AvgSpeed5m:     feat.AvgSpeed5m,
				AvgSpeed10m:    feat.AvgSpeed10m,
				IdleTime5m:     feat.IdleTime5m,
				StopRatio5m:    feat.StopRatio5m,
				SpeedTrend:     feat.SpeedTrend,
				TelemetryAgeS:  feat.TelemetryAgeS,
				PointsCount:    feat.PointsCount,
				DistanceMeters: match.DistanceMeters,
				HorizonSeconds: match.HorizonSeconds,
				StopID:         match.StopID,
				StopName:       match.StopName,
			})

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
			alertMgr.UpsertVehicleAlert(veh, hw, shapFactors, match.HorizonSeconds)
		}(*v, feat, match, headwaySec, hwInfo)
	})

	go func() {
		if err := ndtpSrv.Start(ctx); err != nil {
			log.Printf("[WARN] NDTP Server stopped: %v", err)
		}
	}()

	// 7. Initialize Feeder (Mock / Replay Scenario)
	f, err := feeder.LoadScenario(
		"data/sample/m3_scenario.json",
		"../../data/sample/m3_scenario.json",
		"../data/sample/m3_scenario.json",
	)
	if err != nil {
		log.Printf("[WARN] Scenario file not found, running with NDTP only: %v", err)
	} else {
		log.Println("[INFO] Loaded m3 route scenario successfully")
	}

	// 7.1. Initialize GPS Feeder for real-time historical dataset replay
	var gpsFeeder *feeder.GPSFeeder
	if trackStore != nil && trackStore.TrackCount() > 0 {
		gpsFeeder = feeder.NewGPSFeeder(trackStore.GetAllTracks(), schedMatcher, headwayCalc, alertMgr, mlCli)
		log.Printf("[INFO] Initialized GPSFeeder with %d tracks", trackStore.TrackCount())
	}

	var (
		feederModeMu sync.RWMutex
		feederMode   = "scenario" // "scenario", "gps", or "live"
	)

	// 8. Initialize WebSocket Hub
	hub := ws.NewHub()
	go hub.Run()

	// 9. Broadcast loop (1-2 Hz)
	go func() {
		for {
			feederModeMu.RLock()
			mode := feederMode
			feederModeMu.RUnlock()

			var vehicles []models.Vehicle
			var alert *models.Alert
			var status models.SystemStatus
			simTimeStr := ""

			if mode == "gps" && gpsFeeder != nil {
				// 500ms interval for smooth 2 Hz stream
				tickInterval := 500 * time.Millisecond
				time.Sleep(tickInterval)

				gpsFeeder.AdvanceTick(tickInterval)
				vehicles, alert, status = gpsFeeder.GetState()
				simTimeStr = gpsFeeder.GetSimTime().Format("15:04:05")
			} else if mode == "live" {
				time.Sleep(500 * time.Millisecond)

				liveVehicles := fleetMgr.List()
				if len(liveVehicles) == 0 && f != nil {
					demo, _, _ := f.GetState()
					vehicles = fleetMgr.MergeDemo(demo)
				} else {
					vehicles = liveVehicles
				}

				liveAlerts := alertMgr.GetAll()
				if len(liveAlerts) > 0 {
					alert = &liveAlerts[0]
				}

				status = models.SystemStatus{
					ActiveVehiclesCount: len(vehicles),
					ActiveAlertsCount:   len(liveAlerts),
					PreventedIncidents:  alertMgr.PreventedCount(),
					PunctualityRate:     computePunctuality(vehicles),
					EngineLatencyMs:     2.5,
				}
				simTimeStr = time.Now().Format("15:04:05")
			} else {
				speed := 1.0
				if f != nil {
					speed = f.GetSpeed()
				}
				interval := time.Duration(float64(time.Second) / speed)
				time.Sleep(interval)

				if f != nil {
					f.AdvanceTick()
					vehicles, alert, status = f.GetState()
				}

				// Merge live NDTP units with scenario vehicles
				vehicles = fleetMgr.MergeDemo(vehicles)

				// Merge live DSS alerts
				liveAlerts := alertMgr.GetAll()
				if len(liveAlerts) > 0 {
					alert = &liveAlerts[0]
				}

				status.ActiveVehiclesCount = len(vehicles)
				status.ActiveAlertsCount = len(liveAlerts)
				if f != nil {
					_, scAlert, _ := f.GetState()
					if scAlert != nil && len(liveAlerts) == 0 {
						alert = scAlert
						status.ActiveAlertsCount++
					}
				}
				status.PreventedIncidents = alertMgr.PreventedCount()
				status.PunctualityRate = computePunctuality(vehicles)
			}

			msg := TelemetryWSMessage{
				Type:      "TELEMETRY_UPDATE",
				Status:    status,
				Vehicles:  vehicles,
				Alert:     alert,
				Timestamp: time.Now().Format(time.RFC3339),
				SimTime:   simTimeStr,
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
		// Historical GPS tracks from the training traffic dataset.
		api.RegisterTrackRoutes(r, trackStore)

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
			feederModeMu.RLock()
			mode := feederMode
			feederModeMu.RUnlock()

			if mode == "gps" && gpsFeeder != nil {
				_, _, status := gpsFeeder.GetState()
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(status)
				return
			}
			if mode == "live" {
				liveVehicles := fleetMgr.List()
				liveAlerts := alertMgr.GetAll()
				status := models.SystemStatus{
					ActiveVehiclesCount: len(liveVehicles),
					ActiveAlertsCount:   len(liveAlerts),
					PreventedIncidents:  alertMgr.PreventedCount(),
					PunctualityRate:     computePunctuality(liveVehicles),
					EngineLatencyMs:     2.5,
				}
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(status)
				return
			}

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

		// Vehicles list (demo / GPS + live NDTP)
		r.Get("/vehicles", func(w http.ResponseWriter, r *http.Request) {
			feederModeMu.RLock()
			mode := feederMode
			feederModeMu.RUnlock()

			if mode == "gps" && gpsFeeder != nil {
				vehicles, _, _ := gpsFeeder.GetState()
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(vehicles)
				return
			}
			if mode == "live" {
				liveVehicles := fleetMgr.List()
				if len(liveVehicles) == 0 && f != nil {
					demo, _, _ := f.GetState()
					liveVehicles = fleetMgr.MergeDemo(demo)
				}
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(liveVehicles)
				return
			}

			var demoVehicles []models.Vehicle
			if f != nil {
				demoVehicles, _, _ = f.GetState()
			}
			allVehicles := fleetMgr.MergeDemo(demoVehicles)
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(allVehicles)
		})

		// Real-time CatBoost ML inference & SHAP explanation on demand for any vehicle
		r.Get("/vehicles/{id}/prediction", func(w http.ResponseWriter, r *http.Request) {
			rawID := chi.URLParam(r, "id")
			cleanID := strings.TrimPrefix(rawID, "P")

			feederModeMu.RLock()
			mode := feederMode
			feederModeMu.RUnlock()

			var veh *models.Vehicle
			if mode == "gps" && gpsFeeder != nil {
				veh = gpsFeeder.GetVehicle(rawID)
				if veh == nil {
					veh = gpsFeeder.GetVehicle(cleanID)
				}
				if veh == nil {
					veh = gpsFeeder.GetVehicle("P" + cleanID)
				}
			} else {
				if v, ok := fleetMgr.Get(rawID); ok {
					veh = &v
				} else if v, ok := fleetMgr.Get(cleanID); ok {
					veh = &v
				} else if v, ok := fleetMgr.Get("P" + cleanID); ok {
					veh = &v
				}
			}

			if veh == nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusNotFound)
				json.NewEncoder(w).Encode(map[string]any{"error": "Vehicle not found", "id": rawID})
				return
			}

			ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
			defer cancel()

			pred := mlCli.PredictForVehicle(ctx, *veh)
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(pred)
		})

		// Alerts list
		r.Get("/alerts", func(w http.ResponseWriter, r *http.Request) {
			feederModeMu.RLock()
			mode := feederMode
			feederModeMu.RUnlock()

			if mode == "gps" && gpsFeeder != nil {
				alerts := gpsFeeder.GetAlerts()
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(alerts)
				return
			}
			if mode == "live" {
				alerts := alertMgr.GetAll()
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(alerts)
				return
			}

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
				log.Printf("[INFO] Applied Holding via DSS: vehicle=%s, duration=%d sec", targetVeh, holdSec)
			}

			feederModeMu.RLock()
			mode := feederMode
			feederModeMu.RUnlock()

			if mode == "gps" && gpsFeeder != nil {
				gpsFeeder.ApplyHolding(targetVeh, holdSec)
			} else if mode == "live" {
				fleetMgr.ApplyHolding(targetVeh, holdSec)
			}

			if f != nil {
				f.ApplyHolding(true)
				if targetVeh == "" {
					_, scAlert, _ := f.GetState()
					if scAlert != nil && scAlert.Recommendation != nil {
						targetVeh = scAlert.Recommendation.TargetVehicleID
						holdSec = scAlert.Recommendation.DurationSeconds
						fleetMgr.ApplyHolding(targetVeh, holdSec)
					}
				}
			}

			// Immediate broadcast of updated state
			var demoVehicles []models.Vehicle
			var alert *models.Alert
			var status models.SystemStatus
			simTimeStr := ""

			if mode == "gps" && gpsFeeder != nil {
				demoVehicles, alert, status = gpsFeeder.GetState()
				simTimeStr = gpsFeeder.GetSimTime().Format("15:04:05")
			} else {
				if f != nil {
					demoVehicles, alert, status = f.GetState()
				}
				demoVehicles = fleetMgr.MergeDemo(demoVehicles)
				liveAlerts := alertMgr.GetAll()
				if len(liveAlerts) > 0 {
					alert = &liveAlerts[0]
				}

				status.ActiveVehiclesCount = len(demoVehicles)
				status.ActiveAlertsCount = len(liveAlerts)
				status.PreventedIncidents = alertMgr.PreventedCount()
				status.PunctualityRate = computePunctuality(demoVehicles)
			}

			msg := TelemetryWSMessage{
				Type:      "HOLDING_APPLIED",
				Status:    status,
				Vehicles:  demoVehicles,
				Alert:     alert,
				Timestamp: time.Now().Format(time.RFC3339),
				SimTime:   simTimeStr,
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

		// Simulation control (play/pause/speed/reset/set_mode)
		r.Post("/simulation/control", func(w http.ResponseWriter, r *http.Request) {
			var req SimulationControlRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}

			if req.Action == "set_mode" {
				feederModeMu.Lock()
				if req.Mode == "gps" || req.Mode == "scenario" || req.Mode == "live" {
					feederMode = req.Mode
				}
				feederModeMu.Unlock()

				if req.Mode == "live" {
					go func() {
						bgCtx, bgCancel := context.WithTimeout(context.Background(), 3*time.Second)
						defer bgCancel()
						err := ndtpCli.StartEmulation(bgCtx, targetHost, 9201, []int64{1166336, 122658, 131672}, 3000)
						if err != nil {
							_ = ndtpCli.StartEmulation(bgCtx, "localhost", 9201, []int64{1166336, 122658, 131672}, 3000)
						}
					}()
				}
			}

			feederModeMu.RLock()
			mode := feederMode
			feederModeMu.RUnlock()

			if mode == "gps" && gpsFeeder != nil {
				switch req.Action {
				case "play":
					gpsFeeder.SetPlaying(true)
				case "pause":
					gpsFeeder.SetPlaying(false)
				case "speed":
					if req.Speed > 0 {
						gpsFeeder.SetSpeed(req.Speed)
					}
				case "reset":
					gpsFeeder.Reset()
				}
			} else if f != nil {
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
			json.NewEncoder(w).Encode(map[string]any{
				"status": "ok",
				"action": req.Action,
				"mode":   mode,
			})
		})

		// Start official NDTP emulator stream (:18080 -> :9201)
		r.Post("/simulation/ndtp/start", func(w http.ResponseWriter, r *http.Request) {
			ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
			defer cancel()

			err := ndtpCli.StartEmulation(ctx, targetHost, 9201, []int64{1166336, 122658, 131672}, 3000)
			if err != nil {
				// Retry with localhost if running locally
				err = ndtpCli.StartEmulation(ctx, "localhost", 9201, []int64{1166336, 122658, 131672}, 3000)
			}

			w.Header().Set("Content-Type", "application/json")
			if err != nil {
				w.WriteHeader(http.StatusServiceUnavailable)
				json.NewEncoder(w).Encode(map[string]any{
					"status": "error",
					"error":  err.Error(),
					"hint":   "Ensure ndtp-emu container is running on port 18080",
				})
				return
			}
			json.NewEncoder(w).Encode(map[string]any{
				"status":       "started",
				"emulator_url": ndtpEmuURL,
				"target_host":  targetHost,
				"target_port":  9201,
				"units":        []int64{1166336, 122658, 131672},
				"stream_rate":  "3s",
			})
		})

		// Stop official NDTP emulator stream
		r.Post("/simulation/ndtp/stop", func(w http.ResponseWriter, r *http.Request) {
			ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
			defer cancel()

			targetHost := os.Getenv("NDTP_HOST_FOR_EMULATOR")
			if targetHost == "" {
				targetHost = "backend"
			}

			err := ndtpCli.StopEmulation(ctx, targetHost, 9201)
			if err != nil {
				err = ndtpCli.StopEmulation(ctx, "localhost", 9201)
			}
			w.Header().Set("Content-Type", "application/json")
			if err != nil {
				w.WriteHeader(http.StatusServiceUnavailable)
				json.NewEncoder(w).Encode(map[string]any{"status": "error", "error": err.Error()})
				return
			}
			json.NewEncoder(w).Encode(map[string]any{"status": "stopped"})
		})

		// What-if scenario analysis using Welding passenger waiting formula
		r.Post("/what-if", func(w http.ResponseWriter, r *http.Request) {
			var req engine.WhatIfRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}

			var demoVehicles []models.Vehicle
			if f != nil {
				demoVehicles, _, _ = f.GetState()
			}
			allVehicles := fleetMgr.MergeDemo(demoVehicles)

			res := engine.SimulateWhatIf(req, allVehicles)
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(res)
		})

		// Real stops from timetable index
		r.Get("/stops", func(w http.ResponseWriter, r *http.Request) {
			limit := 200
			if l := r.URL.Query().Get("limit"); l != "" {
				if n, err := strconv.Atoi(l); err == nil && n > 0 {
					limit = n
				}
			}
			stops := schedMatcher.GetAllStops(limit)
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(stops)
		})

		// Executive business KPIs and passenger economic impact
		r.Get("/metrics/business", func(w http.ResponseWriter, r *http.Request) {
			var demoVehicles []models.Vehicle
			if f != nil {
				demoVehicles, _, _ = f.GetState()
			}
			allVehicles := fleetMgr.MergeDemo(demoVehicles)
			alerts := alertMgr.GetAll()
			if f != nil {
				_, scAlert, _ := f.GetState()
				if scAlert != nil {
					alerts = append(alerts, *scAlert)
				}
			}

			kpis := engine.ComputeBusinessKPIs(allVehicles, alerts, alertMgr.PreventedCount())
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(kpis)
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	serverAddr := ":" + port

	log.Printf("[INFO] Starting Situational Predictor Go Server on %s", serverAddr)
	log.Printf("[INFO] NDTP TCP Telemetry Ingestion Receiver on %s", ndtpPort)
	log.Printf("[INFO] Swagger UI Documentation on http://localhost:%s/swagger", port)

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
