package controlplane

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
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

func TestControlPlaneRateLimitIsStoreBacked(t *testing.T) {
	cfg := config.Load(4000)
	cfg.GatewayRateLimit = 1
	cfg.GatewayRateLimitWindow = 60
	path := filepath.Join(t.TempDir(), "store.json")
	firstStore := db.NewSeedStore()
	firstStore.UsePersistence(path)
	first := NewServer(firstStore, cfg)
	recorder := httptest.NewRecorder()
	first.Handler().ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/me", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected first API request allowed, got %d body %s", recorder.Code, recorder.Body.String())
	}

	secondStore := db.NewSeedStore()
	secondStore.UsePersistence(path)
	second := NewServer(secondStore, cfg)
	recorder = httptest.NewRecorder()
	second.Handler().ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/me", nil))
	if recorder.Code != http.StatusTooManyRequests || !bytes.Contains(recorder.Body.Bytes(), []byte("RATE_LIMITED")) {
		t.Fatalf("expected persisted API quota to rate limit, got %d body %s", recorder.Code, recorder.Body.String())
	}
}

func TestControlPlaneRateLimitUsesCanonicalUnknownRouteKey(t *testing.T) {
	cfg := config.Load(4000)
	cfg.GatewayRateLimit = 1
	cfg.GatewayRateLimitWindow = 60
	server := NewServer(db.NewSeedStore(), cfg)
	first := httptest.NewRecorder()
	server.Handler().ServeHTTP(first, httptest.NewRequest(http.MethodGet, "/api/servers/random-one", nil))
	if first.Code != http.StatusNotFound {
		t.Fatalf("expected first unknown API route to reach router, got %d body %s", first.Code, first.Body.String())
	}
	second := httptest.NewRecorder()
	server.Handler().ServeHTTP(second, httptest.NewRequest(http.MethodGet, "/api/servers/random-two", nil))
	if second.Code != http.StatusTooManyRequests || !bytes.Contains(second.Body.Bytes(), []byte("RATE_LIMITED")) {
		t.Fatalf("expected second unknown API route to share canonical quota key, got %d body %s", second.Code, second.Body.String())
	}
}

func TestClientConfigUsesGatewayAndBearerAuth(t *testing.T) {
	cfg := config.Load(4000)
	cfg.GatewayURL = "http://gateway.local"
	server := NewServer(db.NewSeedStore(), cfg)
	body := []byte(`{"client":"opencode","profile":"local","serverId":"00000000-0000-4000-8000-000000000102"}`)
	recorder := httptest.NewRecorder()
	server.Handler().ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/api/client-config/generate", bytes.NewReader(body)))
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body %s", recorder.Code, recorder.Body.String())
	}
	if !bytes.Contains(recorder.Body.Bytes(), []byte("http://gateway.local/mcp/k8s-readonly")) || !bytes.Contains(recorder.Body.Bytes(), []byte("Bearer ${MCPHUB_TOKEN}")) {
		t.Fatalf("expected gateway URL and bearer header in client config: %s", recorder.Body.String())
	}
	if bytes.Contains(recorder.Body.Bytes(), []byte("http://localhost:5102/mcp")) {
		t.Fatalf("client config must not bypass gateway: %s", recorder.Body.String())
	}
}

func TestControlPlaneLaneBSurfaces(t *testing.T) {
	server := NewServer(db.NewSeedStore(), config.Load(4000))

	plainSecret := requestJSON(t, http.MethodPost, "/api/secret-bindings", map[string]interface{}{"scopeType": "server", "scopeId": db.K8sReadonlyID, "provider": "vault", "secretValue": "do-not-store"})
	recorder := httptest.NewRecorder()
	server.Handler().ServeHTTP(recorder, plainSecret)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected plaintext secret rejection, got %d body %s", recorder.Code, recorder.Body.String())
	}

	recorder = httptest.NewRecorder()
	server.Handler().ServeHTTP(recorder, requestJSON(t, http.MethodPost, "/api/secret-bindings", map[string]interface{}{"scopeType": "server", "scopeId": db.K8sReadonlyID, "provider": "vault", "ref": "vault://mcp/k8s-readonly"}))
	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected secret binding create 201, got %d body %s", recorder.Code, recorder.Body.String())
	}

	recorder = httptest.NewRecorder()
	server.Handler().ServeHTTP(recorder, requestJSON(t, http.MethodPost, "/api/audit-events/export", map[string]interface{}{"format": "json", "filters": map[string]string{"server": db.K8sReadonlyID}}))
	if recorder.Code != http.StatusAccepted {
		t.Fatalf("expected audit export 202, got %d body %s", recorder.Code, recorder.Body.String())
	}

	recorder = httptest.NewRecorder()
	server.Handler().ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/tenancy/policy-input?userId="+db.AdminUserID+"&projectId="+db.SampleProjectID, nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected policy input 200, got %d body %s", recorder.Code, recorder.Body.String())
	}

	recorder = httptest.NewRecorder()
	server.Handler().ServeHTTP(recorder, requestJSON(t, http.MethodPost, "/api/servers/"+db.K8sReadonlyID+"/schema-snapshots", map[string]interface{}{}))
	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected schema snapshot 201, got %d body %s", recorder.Code, recorder.Body.String())
	}

	recorder = httptest.NewRecorder()
	server.Handler().ServeHTTP(recorder, requestJSON(t, http.MethodPost, "/api/admin/kill-switch", map[string]interface{}{"reason": "incident", "serverId": db.K8sReadonlyID, "revokeGrants": true}))
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected kill switch 200, got %d body %s", recorder.Code, recorder.Body.String())
	}
}

func TestOpenAPIDocumentUsesMutationResponseStatuses(t *testing.T) {
	document := OpenAPIDocument()
	paths := document["paths"].(map[string]interface{})
	servers := paths["/api/servers"].(map[string]interface{})
	serverPost := servers["post"].(map[string]interface{})
	serverResponses := serverPost["responses"].(map[string]interface{})
	if _, ok := serverResponses["201"]; !ok {
		t.Fatalf("expected server create response status 201, got %#v", serverResponses)
	}
	auditExport := paths["/api/audit-events/export"].(map[string]interface{})
	auditExportPost := auditExport["post"].(map[string]interface{})
	auditExportResponses := auditExportPost["responses"].(map[string]interface{})
	if _, ok := auditExportResponses["202"]; !ok {
		t.Fatalf("expected audit export response status 202, got %#v", auditExportResponses)
	}
}

func requestJSON(t *testing.T, method, path string, body interface{}) *http.Request {
	t.Helper()
	encoded, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}
	request := httptest.NewRequest(method, path, bytes.NewReader(encoded))
	request.Header.Set("content-type", "application/json")
	return request
}
