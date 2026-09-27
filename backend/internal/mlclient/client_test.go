package mlclient

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/mt-hack-predictor/backend/internal/models"
)

func TestMLClient_PredictSuccess(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/predict" {
			http.NotFound(w, r)
			return
		}
		resp := PredictResponse{
			VehicleID:               "1043",
			PredictedDelaySec:       185.0,
			PredictedClass:          "late",
			HorizonSec:              720.0,
			BunchingRiskProbability: 0.75,
			Severity:                "HIGH",
			Factors: []SHAPFactor{
				{Feature: "cur_dev_s", Title: "Текущее отставание", Weight: 65, ImpactScore: 120},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer ts.Close()

	cli := New(ts.URL)
	v := models.Vehicle{
		ID:           "1043",
		RouteID:      "m3",
		DelaySeconds: 90,
		SpeedKmH:     24,
	}

	res := cli.PredictForVehicle(context.Background(), v)
	if res.Fallback {
		t.Fatalf("expected real ML response, got fallback: %s", res.Error)
	}
	if res.PredictedDelaySec != 185.0 {
		t.Fatalf("expected predicted delay 185.0, got %.1f", res.PredictedDelaySec)
	}
	if res.BunchingRiskProbability != 0.75 {
		t.Fatalf("expected bunching prob 0.75, got %.2f", res.BunchingRiskProbability)
	}

	ok, fb := cli.Stats()
	if ok != 1 || fb != 0 {
		t.Fatalf("expected stats ok=1, fb=0, got ok=%d, fb=%d", ok, fb)
	}
}

func TestMLClient_FallbackOffline(t *testing.T) {
	// Point to unreachable port to test graceful degradation
	cli := New("http://127.0.0.1:54321")
	cli.http.Timeout = 50 * time.Millisecond

	v := models.Vehicle{
		ID:           "offline-bus",
		DelaySeconds: 150,
	}

	res := cli.PredictForVehicle(context.Background(), v)
	if !res.Fallback {
		t.Fatal("expected fallback flag to be true when ML service is offline")
	}
	if res.PredictedDelaySec != 150 {
		t.Fatalf("expected persistence delay 150, got %.1f", res.PredictedDelaySec)
	}
	if res.Severity != "MEDIUM" {
		t.Fatalf("expected severity MEDIUM, got %s", res.Severity)
	}
}

func TestMLClient_PredictEnrichedExtendedFeatures(t *testing.T) {
	var receivedReq PredictRequest
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/predict" {
			http.NotFound(w, r)
			return
		}
		if err := json.NewDecoder(r.Body).Decode(&receivedReq); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		resp := PredictResponse{
			VehicleID:               receivedReq.VehicleID,
			TrID:                    receivedReq.TrID,
			PredictedDelaySec:       124.0,
			PredictedClass:          "late",
			HorizonSec:              receivedReq.HorizonSec,
			BunchingRiskProbability: 0.82,
			Severity:                "HIGH",
			Factors: []SHAPFactor{
				{Feature: "dist_to_target_m", Title: "Расстояние до остановки", Weight: 40, ImpactScore: 50},
				{Feature: "speed_mean_5m", Title: "Скорость за 5 мин", Weight: 35, ImpactScore: -20},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer ts.Close()

	cli := New(ts.URL)
	v := models.Vehicle{
		ID:           "test_bus_77",
		RouteID:      "m3",
		DelaySeconds: 45.0,
		SpeedKmH:     22.0,
		Bearing:      90.0,
	}

	res := cli.PredictEnriched(
		context.Background(),
		v,
		60.0,  // curDevSec
		20.0,  // avgSpeed
		360.0, // headwaySec
		EnrichedFeatures{
			CurDevSec:      60.0,
			AvgSpeed:       20.0,
			HeadwaySec:     360.0,
			AvgSpeed3m:     21.5,
			AvgSpeed5m:     18.5,
			AvgSpeed10m:    17.2,
			IdleTime5m:     45.0,
			StopRatio5m:    0.15,
			SpeedTrend:     1.3,
			TelemetryAgeS:  4.0,
			PointsCount:    35,
			DistanceMeters: 1250.0,
			HorizonSeconds: 720.0,
			StopID:         "stop_42",
			StopName:       "Метро Бауманская",
		},
	)

	if res.Fallback {
		t.Fatalf("expected successful prediction, got fallback: %s", res.Error)
	}

	// Verify all extended features were correctly transmitted in the HTTP request payload
	if receivedReq.VehicleID != "test_bus_77" || receivedReq.TrID != "test_bus_77" {
		t.Errorf("expected vehicle_id/tr_id test_bus_77, got %s / %s", receivedReq.VehicleID, receivedReq.TrID)
	}
	if receivedReq.AvgSpeed5m != 18.5 || receivedReq.SpeedMean5m != 18.5 {
		t.Errorf("expected AvgSpeed5m/SpeedMean5m 18.5, got %.1f / %.1f", receivedReq.AvgSpeed5m, receivedReq.SpeedMean5m)
	}
	if receivedReq.AvgSpeed10m != 17.2 || receivedReq.SpeedMean10m != 17.2 {
		t.Errorf("expected AvgSpeed10m/SpeedMean10m 17.2, got %.1f / %.1f", receivedReq.AvgSpeed10m, receivedReq.SpeedMean10m)
	}
	if receivedReq.IdleTime5m != 45.0 {
		t.Errorf("expected IdleTime5m 45.0, got %.1f", receivedReq.IdleTime5m)
	}
	if receivedReq.StopRatio5m != 0.15 || receivedReq.StopRatioWindow != 0.15 {
		t.Errorf("expected StopRatio 0.15, got %.2f / %.2f", receivedReq.StopRatio5m, receivedReq.StopRatioWindow)
	}
	if receivedReq.SpeedTrend != 1.3 {
		t.Errorf("expected SpeedTrend 1.3, got %.1f", receivedReq.SpeedTrend)
	}
	if receivedReq.TelemetryAgeS != 4.0 {
		t.Errorf("expected TelemetryAgeS 4.0, got %.1f", receivedReq.TelemetryAgeS)
	}
	if receivedReq.PointsCount5m != 35 {
		t.Errorf("expected PointsCount5m 35, got %d", receivedReq.PointsCount5m)
	}
	if receivedReq.DistanceMeters != 1250.0 || receivedReq.DistToTargetM != 1250.0 {
		t.Errorf("expected DistanceMeters 1250.0, got %.1f / %.1f", receivedReq.DistanceMeters, receivedReq.DistToTargetM)
	}
	if receivedReq.HorizonSeconds != 720.0 || receivedReq.HorizonSec != 720.0 {
		t.Errorf("expected HorizonSeconds 720.0, got %.1f / %.1f", receivedReq.HorizonSeconds, receivedReq.HorizonSec)
	}
	if receivedReq.TargetStopID != "stop_42" || receivedReq.NextStopID != "stop_42" {
		t.Errorf("expected StopID stop_42, got %s / %s", receivedReq.TargetStopID, receivedReq.NextStopID)
	}
	if receivedReq.NextStopName != "Метро Бауманская" {
		t.Errorf("expected StopName Метро Бауманская, got %s", receivedReq.NextStopName)
	}
	if receivedReq.SpeedNeededKmh <= 0 {
		t.Errorf("expected positive SpeedNeededKmh, got %.2f", receivedReq.SpeedNeededKmh)
	}
}

