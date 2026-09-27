package ndtp

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestEmulatorClientLifecycle(t *testing.T) {
	lastMethod := ""
	lastPath := ""

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		lastMethod = r.Method
		lastPath = r.URL.Path
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status": "ok"}`))
	}))
	defer ts.Close()

	cli := NewEmulatorClient(ts.URL)

	// 1. Start Emulation
	err := cli.StartEmulation(context.Background(), "localhost", 9201, []int64{1166336}, 2000)
	if err != nil {
		t.Fatalf("unexpected error starting emulation: %v", err)
	}
	if lastMethod != "POST" || lastPath != "/api/config" {
		t.Errorf("expected POST /api/config, got %s %s", lastMethod, lastPath)
	}

	// 2. Stop Emulation
	err = cli.StopEmulation(context.Background(), "localhost", 9201)
	if err != nil {
		t.Fatalf("unexpected error stopping emulation: %v", err)
	}
	if lastMethod != "POST" || lastPath != "/api/config" {
		t.Errorf("expected POST /api/config, got %s %s", lastMethod, lastPath)
	}

	// 3. Get Config
	_, err = cli.GetConfig(context.Background())
	if err != nil {
		t.Fatalf("unexpected error getting config: %v", err)
	}
	if lastMethod != "GET" || lastPath != "/api/config" {
		t.Errorf("expected GET /api/config, got %s %s", lastMethod, lastPath)
	}
}
