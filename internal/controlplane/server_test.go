package controlplane

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/mcp-hub/mcp-hub/internal/auth"
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

func TestControlPlaneRuntimeStatusAndLeaseRevocation(t *testing.T) {
	store := db.NewSeedStore()
	server := NewServer(store, config.Load(4000))
	principal := auth.MockAdmin()
	store.UpsertRuntimeStatus(db.RuntimeStatus{ServerID: db.K8sReadonlyID, ServerSlug: "k8s-readonly", ManifestHash: "hash", Phase: "rendered", Namespace: "mcp-runtime", ResourceKinds: []string{"Deployment"}, ResourceCount: 1, LastReconciledAt: db.Now(), UpdatedAt: db.Now()}, principal, "trace", nil)
	store.UpsertSecretLeases([]db.SecretLease{{ID: "lease-1", ServerID: db.K8sReadonlyID, ServerSlug: "k8s-readonly", SecretRef: "kubeconfig", TargetEnv: "KUBECONFIG", Status: "active", IssuedAt: db.Now(), ExpiresAt: db.Now(), LeaseDurationSeconds: 600}}, principal, "trace", nil)

	recorder := httptest.NewRecorder()
	server.Handler().ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/runtime/status", nil))
	if recorder.Code != http.StatusOK || !bytes.Contains(recorder.Body.Bytes(), []byte("k8s-readonly")) {
		t.Fatalf("expected runtime status response, got %d %s", recorder.Code, recorder.Body.String())
	}

	recorder = httptest.NewRecorder()
	server.Handler().ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/api/runtime/secret-leases/lease-1/revoke", nil))
	if recorder.Code != http.StatusOK || !bytes.Contains(recorder.Body.Bytes(), []byte("revoked")) {
		t.Fatalf("expected revoked lease response, got %d %s", recorder.Code, recorder.Body.String())
	}
}

func TestControlPlaneRuntimeSecretLeaseListRequiresAdmin(t *testing.T) {
	t.Setenv("MCP_AUTH_MODE", "oidc")
	t.Setenv("MCP_TRUSTED_AUTH_HEADER_TOKEN", "trusted-proxy-token")
	store := db.NewSeedStore()
	server := NewServer(store, config.Load(4000))
	principal := auth.MockAdmin()
	store.UpsertRuntimeStatus(db.RuntimeStatus{ServerID: db.K8sReadonlyID, ServerSlug: "k8s-readonly", ManifestHash: "hash", Phase: "rendered", Namespace: "mcp-runtime", ResourceKinds: []string{"Deployment"}, ResourceCount: 1, LastReconciledAt: db.Now(), UpdatedAt: db.Now()}, principal, "trace", nil)
	store.UpsertSecretLeases([]db.SecretLease{{ID: "lease-1", ServerID: db.K8sReadonlyID, ServerSlug: "k8s-readonly", SecretRef: "kubeconfig", TargetEnv: "KUBECONFIG", Status: "active", IssuedAt: db.Now(), ExpiresAt: db.Now(), LeaseDurationSeconds: 600}}, principal, "trace", nil)

	statusReq := httptest.NewRequest(http.MethodGet, "/api/runtime/status", nil)
	statusReq.Header.Set("x-user-id", "reader@example.com")
	statusReq.Header.Set("x-roles", "reader")
	statusReq.Header.Set("x-auth-proxy-token", "trusted-proxy-token")
	statusRecorder := httptest.NewRecorder()
	server.Handler().ServeHTTP(statusRecorder, statusReq)
	if statusRecorder.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for reader runtime status, got %d %s", statusRecorder.Code, statusRecorder.Body.String())
	}

	readerReq := httptest.NewRequest(http.MethodGet, "/api/runtime/secret-leases", nil)
	readerReq.Header.Set("x-user-id", "reader@example.com")
	readerReq.Header.Set("x-roles", "reader")
	readerReq.Header.Set("x-auth-proxy-token", "trusted-proxy-token")
	readerRecorder := httptest.NewRecorder()
	server.Handler().ServeHTTP(readerRecorder, readerReq)
	if readerRecorder.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for reader lease list, got %d %s", readerRecorder.Code, readerRecorder.Body.String())
	}

	adminReq := httptest.NewRequest(http.MethodGet, "/api/runtime/secret-leases", nil)
	adminReq.Header.Set("x-user-id", "admin@example.com")
	adminReq.Header.Set("x-roles", "platform_admin")
	adminReq.Header.Set("x-auth-proxy-token", "trusted-proxy-token")
	adminRecorder := httptest.NewRecorder()
	server.Handler().ServeHTTP(adminRecorder, adminReq)
	if adminRecorder.Code != http.StatusOK || !bytes.Contains(adminRecorder.Body.Bytes(), []byte("lease-1")) {
		t.Fatalf("expected admin lease list response, got %d %s", adminRecorder.Code, adminRecorder.Body.String())
	}
}

func TestControlPlaneVersionListRequiresAdmin(t *testing.T) {
	t.Setenv("MCP_AUTH_MODE", "oidc")
	t.Setenv("MCP_TRUSTED_AUTH_HEADER_TOKEN", "trusted-proxy-token")
	server := NewServer(db.NewSeedStore(), config.Load(4000))

	readerReq := httptest.NewRequest(http.MethodGet, "/api/servers/"+db.K8sReadonlyID+"/versions", nil)
	readerReq.Header.Set("x-auth-proxy-token", "trusted-proxy-token")
	readerReq.Header.Set("x-user-id", "reader@example.com")
	readerReq.Header.Set("x-roles", "reader")
	readerRecorder := httptest.NewRecorder()
	server.Handler().ServeHTTP(readerRecorder, readerReq)
	if readerRecorder.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for reader version list, got %d %s", readerRecorder.Code, readerRecorder.Body.String())
	}

	adminReq := httptest.NewRequest(http.MethodGet, "/api/servers/"+db.K8sReadonlyID+"/versions", nil)
	adminReq.Header.Set("x-auth-proxy-token", "trusted-proxy-token")
	adminReq.Header.Set("x-user-id", "admin@example.com")
	adminReq.Header.Set("x-roles", "platform_admin")
	adminRecorder := httptest.NewRecorder()
	server.Handler().ServeHTTP(adminRecorder, adminReq)
	if adminRecorder.Code != http.StatusOK {
		t.Fatalf("expected 200 for admin version list, got %d %s", adminRecorder.Code, adminRecorder.Body.String())
	}
}

func TestControlPlaneVersionManifestRejectsRawSecret(t *testing.T) {
	t.Setenv("MCP_AUTH_MODE", "mock")
	server := NewServer(db.NewSeedStore(), config.Load(4000))
	body := map[string]interface{}{
		"version": "v2",
		"manifestJson": map[string]interface{}{
			"slug":                   "bad-secret",
			"displayName":            "Bad Secret",
			"ownerTeamId":            db.PlatformTeamID,
			"environment":            "dev",
			"transport":              "streamable_http",
			"riskLevel":              "low",
			"implementationLanguage": "go",
			"secrets":                []interface{}{map[string]interface{}{"ref": "provider", "targetEnv": "PROVIDER_TOKEN", "secretName": "provider", "secretKey": "token", "apiKey": "raw-secret"}},
			"tools":                  []interface{}{map[string]interface{}{"name": "probe", "riskLevel": "low", "readOnly": true, "inputSchema": map[string]interface{}{"type": "object", "properties": map[string]interface{}{}, "additionalProperties": false}}},
		},
	}
	encoded, _ := json.Marshal(body)
	recorder := httptest.NewRecorder()
	server.Handler().ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/api/servers/"+db.K8sReadonlyID+"/versions", bytes.NewReader(encoded)))
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for raw manifest secret, got %d %s", recorder.Code, recorder.Body.String())
	}
}

func TestControlPlaneAnalyticsAndTraceHeaders(t *testing.T) {
	store := db.NewSeedStore()
	store.AddAudit(db.AuditEvent{Timestamp: "2026-06-07T10:00:00Z", UserID: db.AdminUserID, TeamID: db.PlatformTeamID, ProjectID: db.SampleProjectID, ClientID: "client-a", ServerID: db.K8sReadonlyID, ToolName: "list_pods", EventType: "tool.call.denied", RiskLevel: db.RiskHigh, PolicyDecision: db.PolicyDeny, TraceID: "trace-denied", ErrorCode: "NO_MATCHING_GRANT", LatencyMS: 19})
	server := NewServer(store, config.Load(4000))

	req := httptest.NewRequest(http.MethodGet, "/api/analytics/denied-calls", nil)
	req.Header.Set("x-trace-id", "trace-request")
	req.Header.Set("x-request-id", "request-1")
	recorder := httptest.NewRecorder()
	server.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body %s", recorder.Code, recorder.Body.String())
	}
	if recorder.Header().Get("x-trace-id") != "trace-request" || recorder.Header().Get("x-request-id") != "request-1" || recorder.Header().Get("traceparent") == "" {
		t.Fatalf("missing correlation headers: %#v", recorder.Header())
	}
	var denied db.DeniedCallAnalytics
	if err := json.Unmarshal(recorder.Body.Bytes(), &denied); err != nil {
		t.Fatal(err)
	}
	if denied.TotalDenied != 1 || denied.ByReason[0].Reason != "NO_MATCHING_GRANT" {
		t.Fatalf("unexpected denied analytics: %#v", denied)
	}

	recorder = httptest.NewRecorder()
	server.Handler().ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/analytics/usage/export?period=daily", nil))
	if recorder.Code != http.StatusOK || !bytes.Contains(recorder.Body.Bytes(), []byte("period,team_id")) {
		t.Fatalf("expected usage CSV, got %d body %s", recorder.Code, recorder.Body.String())
	}
}

func TestControlPlaneAnalyticsRequiresAdmin(t *testing.T) {
	t.Setenv("MCP_AUTH_MODE", "oidc")
	server := NewServer(db.NewSeedStore(), config.Load(4000))
	req := httptest.NewRequest(http.MethodGet, "/api/analytics/usage", nil)
	req.Header.Set("x-mcp-hub-trusted-proxy", "forged")
	req.Header.Set("x-user-id", "attacker")
	req.Header.Set("x-roles", "platform_admin")
	recorder := httptest.NewRecorder()
	server.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected forged trusted header to be rejected with 403, got %d body %s", recorder.Code, recorder.Body.String())
	}

	t.Setenv("MCP_TRUSTED_PROXY_SECRET", "test-secret")
	req = httptest.NewRequest(http.MethodGet, "/api/analytics/usage", nil)
	req.Header.Set("x-user-id", "reader")
	req.Header.Set("x-roles", "reader")
	req.Header.Set("x-mcp-hub-trusted-proxy", "test-secret")
	recorder = httptest.NewRecorder()
	server.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d body %s", recorder.Code, recorder.Body.String())
	}

	req = httptest.NewRequest(http.MethodGet, "/api/analytics/usage", nil)
	req.Header.Set("x-user-id", "admin")
	req.Header.Set("x-roles", "platform_admin")
	req.Header.Set("x-mcp-hub-trusted-proxy", "test-secret")
	recorder = httptest.NewRecorder()
	server.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected trusted platform admin to get 200, got %d body %s", recorder.Code, recorder.Body.String())
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

func TestControlPlaneComplianceExportRequiresAdminAndRange(t *testing.T) {
	t.Setenv("MCP_AUTH_MODE", "oidc")
	t.Setenv("MCP_TRUSTED_AUTH_HEADER_TOKEN", "trusted-proxy-token")
	server := NewServer(db.NewSeedStore(), config.Load(4000))
	req := httptest.NewRequest(http.MethodGet, "/api/audit-events/export?from=2026-06-07T00:00:00Z&to=2026-06-08T00:00:00Z", nil)
	req.Header.Set("x-auth-proxy-token", "trusted-proxy-token")
	req.Header.Set("x-user-id", "reader")
	req.Header.Set("x-roles", "reader")
	recorder := httptest.NewRecorder()
	server.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", recorder.Code)
	}

	req = httptest.NewRequest(http.MethodGet, "/api/audit-events/export?from=2026-06-07T00:00:00Z&to=2026-06-08T00:00:00Z", nil)
	req.Header.Set("x-auth-proxy-token", "trusted-proxy-token")
	req.Header.Set("x-user-id", "admin")
	req.Header.Set("x-roles", "platform_admin")
	recorder = httptest.NewRecorder()
	server.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body %s", recorder.Code, recorder.Body.String())
	}
	var body map[string]interface{}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["redacted"] != true || body["exportId"] == "" {
		t.Fatalf("expected redacted export envelope, got %#v", body)
	}
}

func TestControlPlaneSignedComplianceExportRequiresKey(t *testing.T) {
	server := NewServer(db.NewSeedStore(), config.Load(4000))
	req := httptest.NewRequest(http.MethodGet, "/api/audit-events/export?from=2026-06-07T00:00:00Z&to=2026-06-08T00:00:00Z&signed=true", nil)
	recorder := httptest.NewRecorder()
	server.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 without signing key, got %d", recorder.Code)
	}

	t.Setenv("MCP_COMPLIANCE_EXPORT_SIGNING_KEY", "test-key")
	recorder = httptest.NewRecorder()
	server.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK || !bytes.Contains(recorder.Body.Bytes(), []byte("HMAC-SHA256")) {
		t.Fatalf("expected signed export, got %d body %s", recorder.Code, recorder.Body.String())
	}
}
