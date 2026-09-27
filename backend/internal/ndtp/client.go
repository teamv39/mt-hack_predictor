package ndtp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// EmulatorConfig represents the official payload expected by ndtp-telemetry-emulator /api/config.
type EmulatorConfig struct {
	TargetHost string         `json:"targetHost"`
	TargetPort int            `json:"targetPort"`
	Units      []EmulatorUnit `json:"units"`
}

// EmulatorUnit specifies configuration for one emulated vehicle terminal.
type EmulatorUnit struct {
	UnitID       int64  `json:"unitId"`
	IntervalMs   int64  `json:"intervalMs"`
	AutoGenerate bool   `json:"autoGenerate"`
	Cells        []any  `json:"cells"`
}

// EmulatorClient communicates with the official ndtp-telemetry-emulator REST API (:18080).
type EmulatorClient struct {
	baseURL    string
	httpClient *http.Client
}

// NewEmulatorClient creates a client pointing to the emulator API (e.g. http://localhost:18080 or http://ndtp-emu:18080).
func NewEmulatorClient(baseURL string) *EmulatorClient {
	if baseURL == "" {
		baseURL = "http://localhost:18080"
	}
	return &EmulatorClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 2 * time.Second,
		},
	}
}

// StartEmulation sends active unit configuration to initiate NDTP streaming.
func (c *EmulatorClient) StartEmulation(ctx context.Context, targetHost string, targetPort int, unitIDs []int64, intervalMs int64) error {
	if targetHost == "" {
		targetHost = "backend"
	}
	if targetPort <= 0 {
		targetPort = 9201
	}
	if len(unitIDs) == 0 {
		unitIDs = []int64{1166336, 122658, 131672}
	}
	if intervalMs <= 0 {
		intervalMs = 3000
	}

	units := make([]EmulatorUnit, 0, len(unitIDs))
	for _, uid := range unitIDs {
		units = append(units, EmulatorUnit{
			UnitID:       uid,
			IntervalMs:   intervalMs,
			AutoGenerate: true,
			Cells:        []any{},
		})
	}

	cfg := EmulatorConfig{
		TargetHost: targetHost,
		TargetPort: targetPort,
		Units:      units,
	}

	data, err := json.Marshal(cfg)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/api/config", bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("emulator connection error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return fmt.Errorf("emulator error %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// StopEmulation clears all units, halting the TCP telemetry stream.
func (c *EmulatorClient) StopEmulation(ctx context.Context, targetHost string, targetPort int) error {
	if targetHost == "" {
		targetHost = "backend"
	}
	if targetPort <= 0 {
		targetPort = 9201
	}

	cfg := EmulatorConfig{
		TargetHost: targetHost,
		TargetPort: targetPort,
		Units:      []EmulatorUnit{},
	}

	data, err := json.Marshal(cfg)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/api/config", bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("emulator connection error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return fmt.Errorf("emulator error %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// GetConfig fetches current configuration from the emulator.
func (c *EmulatorClient) GetConfig(ctx context.Context) (map[string]any, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/api/config", nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("emulator status: %d", resp.StatusCode)
	}

	var out map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	return out, nil
}
