package controlplane

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mcp-hub/mcp-hub/internal/config"
	"github.com/mcp-hub/mcp-hub/internal/db"
)

func TestControlPlaneListsServersAndRecordsMutationAudit(t *testing.T) {
	server := NewServer(db.NewSeedStore(), config.Load(4000))
	recorder := httptest.NewRecorder()
	server.Handler().ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/servers", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}

	body := map[string]interface{}{"slug": "docs-prod", "displayName": "Docs Prod", "ownerTeamId": db.PlatformTeamID, "environment": "dev", "transport": "streamable_http", "upstreamUrl": "http://localhost:5199/mcp", "enabled": true, "riskLevel": "low", "tools": []map[string]interface{}{{"name": "search", "enabled": true, "riskLevel": "low", "inputSchema": map[string]interface{}{"type": "object", "properties": map[string]interface{}{}, "additionalProperties": false}}}}
	encoded, _ := json.Marshal(body)
	recorder = httptest.NewRecorder()
	server.Handler().ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/api/servers", bytes.NewReader(encoded)))
	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d body %s", recorder.Code, recorder.Body.String())
	}

	audit := server.Store().ListAuditEvents(10, "", map[string]string{"event_type": "mcp_server.created"})
	if len(audit.Items) != 1 {
		t.Fatalf("expected mutation audit event, got %d", len(audit.Items))
	}
}

func TestControlPlaneRequiresAdminForMutation(t *testing.T) {
	t.Setenv("MCP_AUTH_MODE", "oidc")
	server := NewServer(db.NewSeedStore(), config.Load(4000))
	req := httptest.NewRequest(http.MethodPost, "/api/servers", bytes.NewReader([]byte(`{}`)))
	req.Header.Set("x-roles", "reader")
	recorder := httptest.NewRecorder()
	server.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", recorder.Code)
	}
}
