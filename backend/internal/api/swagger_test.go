package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
)

func TestRegisterSwagger(t *testing.T) {
	r := chi.NewRouter()
	RegisterSwagger(r)

	// 1. Check doc.json
	recDoc := httptest.NewRecorder()
	reqDoc, _ := http.NewRequest(http.MethodGet, "/swagger/doc.json", nil)
	r.ServeHTTP(recDoc, reqDoc)

	if recDoc.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for /swagger/doc.json, got %d", recDoc.Code)
	}
	if !strings.Contains(recDoc.Body.String(), "MT-Predictor Backend API") {
		t.Fatal("doc.json does not contain expected OpenAPI title")
	}

	// 2. Check UI
	recUI := httptest.NewRecorder()
	reqUI, _ := http.NewRequest(http.MethodGet, "/swagger", nil)
	r.ServeHTTP(recUI, reqUI)

	if recUI.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for /swagger, got %d", recUI.Code)
	}
	if !strings.Contains(recUI.Body.String(), "SwaggerUIBundle") {
		t.Fatal("/swagger does not render SwaggerUIBundle script")
	}
}
