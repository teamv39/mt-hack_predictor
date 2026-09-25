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
