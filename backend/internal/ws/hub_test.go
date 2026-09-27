package ws

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestHub_Broadcast(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	server := httptest.NewServer(http.HandlerFunc(hub.HandleWebSocket))
	defer server.Close()

	// Convert http URL to ws URL
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	// Connect first client
	ws1, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("failed to dial ws1: %v", err)
	}
	defer ws1.Close()

	// Connect second client
	ws2, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("failed to dial ws2: %v", err)
	}
	defer ws2.Close()

	// Allow connection registration
	time.Sleep(50 * time.Millisecond)

	// Broadcast test message
	testMsg := []byte(`{"type":"PING","value":42}`)
	hub.Broadcast(testMsg)

	// Read from client 1
	_ = ws1.SetReadDeadline(time.Now().Add(1 * time.Second))
	_, msg1, err := ws1.ReadMessage()
	if err != nil {
		t.Fatalf("ws1 failed to read message: %v", err)
	}
	if string(msg1) != string(testMsg) {
		t.Errorf("ws1 expected %s, got %s", string(testMsg), string(msg1))
	}

	// Read from client 2
	_ = ws2.SetReadDeadline(time.Now().Add(1 * time.Second))
	_, msg2, err := ws2.ReadMessage()
	if err != nil {
		t.Fatalf("ws2 failed to read message: %v", err)
	}
	if string(msg2) != string(testMsg) {
		t.Errorf("ws2 expected %s, got %s", string(testMsg), string(msg2))
	}
}
