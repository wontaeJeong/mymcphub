package gateway

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/mcp-hub/mcp-hub/internal/auth"
	"github.com/mcp-hub/mcp-hub/internal/config"
	"github.com/mcp-hub/mcp-hub/internal/db"
	"github.com/mcp-hub/mcp-hub/internal/mcp"
)

func TestGatewayFiltersDiscoveryAndCallsAllowedTool(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"jsonrpc": "2.0", "id": float64(2), "result": map[string]interface{}{"content": []interface{}{map[string]interface{}{"type": "text", "text": "ok"}}}})
	}))
	defer upstream.Close()
	store := db.NewSeedStore()
	principal := auth.MockAdmin()
	server, err := store.CreateServer(db.MCPServer{Slug: "filtered", DisplayName: "Filtered", OwnerTeamID: db.PlatformTeamID, Environment: db.EnvironmentDev, Transport: db.TransportStreamableHTTP, UpstreamURL: upstream.URL, Enabled: true, RiskLevel: db.RiskLow}, []db.MCPTool{{Name: "allowed", Enabled: true, RiskLevel: db.RiskLow, InputSchema: map[string]interface{}{"type": "object", "properties": map[string]interface{}{}, "additionalProperties": false}}, {Name: "hidden", Enabled: true, RiskLevel: db.RiskLow, InputSchema: map[string]interface{}{"type": "object", "properties": map[string]interface{}{}, "additionalProperties": false}}}, principal, "trace", nil)
	if err != nil {
		t.Fatal(err)
	}
	_, err = store.CreateGrant(db.Grant{SubjectType: db.SubjectTeam, SubjectID: db.PlatformTeamID, ProjectID: db.SampleProjectID, ServerID: server.ID, AllowedTools: []string{"allowed"}, Environment: db.EnvironmentDev, Reason: "test", Enabled: true}, principal, "trace", nil)
	if err != nil {
		t.Fatal(err)
	}
	handler := NewServer(store, config.Load(5000), nil).Handler()

	list := postMCP(t, handler, "/mcp/filtered", map[string]interface{}{"jsonrpc": "2.0", "id": 1, "method": "tools/list"})
	if list.Code != http.StatusOK {
		t.Fatalf("list status %d", list.Code)
	}
	if bytes.Contains(list.Body.Bytes(), []byte("hidden")) {
		t.Fatalf("unauthorized tool leaked in tools/list: %s", list.Body.String())
	}

	call := postMCP(t, handler, "/mcp/filtered", map[string]interface{}{"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": map[string]interface{}{"name": "allowed", "arguments": map[string]interface{}{"token": "secret-value"}}})
	if call.Code != http.StatusOK {
		t.Fatalf("call status %d body %s", call.Code, call.Body.String())
	}
	audit := store.ListAuditEvents(20, "", map[string]string{"event_type": "tool.call.succeeded"})
	if len(audit.Items) == 0 || bytes.Contains(mustJSONBytes(audit.Items[0].ArgumentRedactedJSON), []byte("secret-value")) {
		t.Fatalf("expected redacted successful audit event")
	}
}

func TestGatewayDeniesUnauthenticatedMCP(t *testing.T) {
	handler := NewServer(db.NewSeedStore(), config.Load(5000), nil).Handler()
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/mcp/k8s-readonly", bytes.NewReader([]byte(`{"jsonrpc":"2.0","id":1,"method":"tools/list"}`))))
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", recorder.Code)
	}
	if recorder.Header().Get("www-authenticate") == "" {
		t.Fatal("expected WWW-Authenticate challenge")
	}
}

func TestGatewayRejectsMalformedMCPRoutes(t *testing.T) {
	handler := NewServer(db.NewSeedStore(), config.Load(5000), nil).Handler()
	for _, path := range []string{"/k8s-readonly", "/mcpk8s-readonly", "/mcp/k8s-readonly/extra", "/mcp", "/mcp/", "/mcp//k8s-readonly", "/mcp/k8s-readonly/", "/mcp/k8s-readonly//"} {
		recorder := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req.Header.Set("authorization", "Bearer dev-admin-token")
		handler.ServeHTTP(recorder, req)
		if recorder.Code != http.StatusNotFound {
			t.Fatalf("expected %s to be route-not-found, got %d body %s", path, recorder.Code, recorder.Body.String())
		}
	}
}

func TestGatewayDeniesCrossProjectGrantUse(t *testing.T) {
	t.Setenv("MCP_AUTH_MODE", "oidc")
	t.Setenv("OIDC_HS256_SECRET", "test-secret")
	t.Setenv("OIDC_ISSUER_URL", "https://issuer.example")
	t.Setenv("OIDC_AUDIENCE", "mcp-hub")
	t.Setenv("OIDC_REQUIRED_SCOPE", "mcp:gateway")
	handler := NewServer(db.NewSeedStore(), config.Load(5000), nil).Handler()
	recorder := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/mcp/k8s-readonly", bytes.NewReader([]byte(`{"jsonrpc":"2.0","id":1,"method":"tools/list"}`)))
	req.Header.Set("content-type", "application/json")
	req.Header.Set("authorization", "Bearer "+gatewayTestJWT(t, map[string]interface{}{"iss": "https://issuer.example", "aud": "mcp-hub", "exp": time.Now().Add(time.Hour).Unix(), "sub": "user-1", "client_id": "oidc-client", "project_id": "00000000-0000-4000-8000-000000000099", "scope": "mcp:gateway", "roles": []string{"admin"}, "team_ids": []string{db.PlatformTeamID}}))
	handler.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusForbidden || !bytes.Contains(recorder.Body.Bytes(), []byte("CONNECT_GRANT_REQUIRED")) {
		t.Fatalf("expected cross-project grant deny, got %d body %s", recorder.Code, recorder.Body.String())
	}
}

func TestGatewayLocalFallbackDoesNotEchoSecretArguments(t *testing.T) {
	store := db.NewSeedStore()
	principal := auth.MockAdmin()
	server, err := store.CreateServer(db.MCPServer{Slug: "local-safe", DisplayName: "Local Safe", OwnerTeamID: db.PlatformTeamID, Environment: db.EnvironmentDev, Transport: db.TransportStreamableHTTP, Enabled: true, RiskLevel: db.RiskLow}, []db.MCPTool{{Name: "probe", Enabled: true, RiskLevel: db.RiskLow, InputSchema: map[string]interface{}{"type": "object"}}}, principal, "trace", nil)
	if err != nil {
		t.Fatal(err)
	}
	_, err = store.CreateGrant(db.Grant{SubjectType: db.SubjectTeam, SubjectID: db.PlatformTeamID, ProjectID: db.SampleProjectID, ServerID: server.ID, AllowedTools: []string{"probe"}, Environment: db.EnvironmentDev, Reason: "local", Enabled: true}, principal, "trace", nil)
	if err != nil {
		t.Fatal(err)
	}
	response := postMCP(t, NewServer(store, config.Load(5000), nil).Handler(), "/mcp/local-safe", map[string]interface{}{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": map[string]interface{}{"name": "probe", "arguments": map[string]interface{}{"token": "secret-value"}}})
	if response.Code != http.StatusOK || bytes.Contains(response.Body.Bytes(), []byte("secret-value")) {
		t.Fatalf("expected local fallback to avoid echoing secret arguments, status=%d body=%s", response.Code, response.Body.String())
	}
}

func TestGatewayRejectsUnregisteredOIDCClient(t *testing.T) {
	t.Setenv("MCP_AUTH_MODE", "oidc")
	t.Setenv("OIDC_HS256_SECRET", "test-secret")
	t.Setenv("OIDC_ISSUER_URL", "https://issuer.example")
	t.Setenv("OIDC_AUDIENCE", "mcp-hub")
	t.Setenv("OIDC_REQUIRED_SCOPE", "mcp:gateway")
	handler := NewServer(db.NewSeedStore(), config.Load(5000), nil).Handler()
	recorder := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/mcp/k8s-readonly", nil)
	req.Header.Set("authorization", "Bearer "+gatewayTestJWT(t, map[string]interface{}{"iss": "https://issuer.example", "aud": "mcp-hub", "exp": time.Now().Add(time.Hour).Unix(), "sub": "user-1", "client_id": "unregistered-client", "scope": "mcp:gateway", "roles": []string{"admin"}, "team_ids": []string{db.PlatformTeamID}}))
	handler.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusForbidden || !bytes.Contains(recorder.Body.Bytes(), []byte("CLIENT_NOT_REGISTERED")) {
		t.Fatalf("expected unregistered client deny, got %d body %s", recorder.Code, recorder.Body.String())
	}
}

func TestGatewayCreatesStreamableHTTPSession(t *testing.T) {
	handler := NewServer(db.NewSeedStore(), config.Load(5000), nil).Handler()
	init := postMCP(t, handler, "/mcp/k8s-readonly", map[string]interface{}{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": map[string]interface{}{"clientInfo": map[string]interface{}{"name": "test-client"}, "roots": []interface{}{map[string]interface{}{"uri": "file:///tmp"}}}})
	if init.Code != http.StatusOK {
		t.Fatalf("initialize status %d body %s", init.Code, init.Body.String())
	}
	sessionID := init.Header().Get("mcp-session-id")
	if sessionID == "" || !bytes.Contains(init.Body.Bytes(), []byte(sessionID)) {
		t.Fatalf("expected session id in header and body, header=%q body=%s", sessionID, init.Body.String())
	}
	initialized := postMCPWithHeaders(t, handler, "/mcp/k8s-readonly", map[string]interface{}{"jsonrpc": "2.0", "method": "notifications/initialized"}, map[string]string{"mcp-session-id": sessionID})
	if initialized.Code != http.StatusAccepted {
		t.Fatalf("initialized status %d body %s", initialized.Code, initialized.Body.String())
	}
}

func TestSessionRejectsProjectMismatch(t *testing.T) {
	manager := NewSessionManager(time.Minute)
	principal := auth.MockAdmin()
	server := db.MCPServer{ID: "server-1", Slug: "server"}
	created := manager.Resolve(httptest.NewRequest(http.MethodPost, "/mcp/server", nil), mcp.Request{Method: "initialize", Params: map[string]interface{}{}}, principal, server)
	principal.ProjectID = "other-project"
	req := httptest.NewRequest(http.MethodPost, "/mcp/server", nil)
	req.Header.Set("mcp-session-id", created.ID)
	resolved := manager.Resolve(req, mcp.Request{Method: "tools/list", Params: map[string]interface{}{}}, principal, server)
	if resolved.ErrorCode != "MCP_SESSION_PRINCIPAL_MISMATCH" {
		t.Fatalf("expected project mismatch to reject session, got %#v", resolved)
	}
}

func TestGatewayRateLimitsByUserClientServerToolDimension(t *testing.T) {
	t.Setenv("MCP_GATEWAY_RATE_LIMIT", "1")
	t.Setenv("MCP_GATEWAY_RATE_LIMIT_WINDOW_SECONDS", "60")
	handler := NewServer(db.NewSeedStore(), config.Load(5000), nil).Handler()
	first := postMCP(t, handler, "/mcp/k8s-readonly", map[string]interface{}{"jsonrpc": "2.0", "id": 1, "method": "tools/list"})
	if first.Code != http.StatusOK {
		t.Fatalf("first status %d body %s", first.Code, first.Body.String())
	}
	second := postMCP(t, handler, "/mcp/k8s-readonly", map[string]interface{}{"jsonrpc": "2.0", "id": 2, "method": "tools/list"})
	if second.Code != http.StatusTooManyRequests || second.Header().Get("retry-after") == "" || !bytes.Contains(second.Body.Bytes(), []byte("RATE_LIMITED")) {
		t.Fatalf("expected structured 429, status=%d headers=%v body=%s", second.Code, second.Header(), second.Body.String())
	}
}

func TestGatewayRateLimitedInitializeDoesNotAllocateSession(t *testing.T) {
	t.Setenv("MCP_GATEWAY_RATE_LIMIT", "1")
	t.Setenv("MCP_GATEWAY_RATE_LIMIT_WINDOW_SECONDS", "60")
	server := NewServer(db.NewSeedStore(), config.Load(5000), nil)
	handler := server.Handler()
	body := map[string]interface{}{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": map[string]interface{}{"clientInfo": map[string]interface{}{"name": "test-client"}}}
	first := postMCP(t, handler, "/mcp/k8s-readonly", body)
	if first.Code != http.StatusOK || server.sessions.Active() != 1 {
		t.Fatalf("expected first initialize to create one session, status=%d sessions=%d body=%s", first.Code, server.sessions.Active(), first.Body.String())
	}
	second := postMCP(t, handler, "/mcp/k8s-readonly", body)
	if second.Code != http.StatusTooManyRequests || server.sessions.Active() != 1 || second.Header().Get("mcp-session-id") != "" {
		t.Fatalf("expected rate-limited initialize without new session, status=%d sessions=%d header=%q body=%s", second.Code, server.sessions.Active(), second.Header().Get("mcp-session-id"), second.Body.String())
	}
}

func TestGatewayStepUpTokenIsRequiredAndOneTime(t *testing.T) {
	upstreamCalls := 0
	upstream := fakeUpstream{call: func(ctx context.Context, server db.MCPServer, request mcp.Request, traceID string) (mcp.Response, int, error) {
		upstreamCalls++
		return mcp.Result(request.ID, map[string]interface{}{"ok": true}), 200, nil
	}}
	store := db.NewSeedStore()
	principal := auth.MockAdmin()
	server, err := store.CreateServer(db.MCPServer{Slug: "critical", DisplayName: "Critical", OwnerTeamID: db.PlatformTeamID, Environment: db.EnvironmentDev, Transport: db.TransportStreamableHTTP, Enabled: true, RiskLevel: db.RiskCritical}, []db.MCPTool{{Name: "rotate_secret", Enabled: true, RiskLevel: db.RiskCritical, InputSchema: map[string]interface{}{"type": "object"}}}, principal, "trace", nil)
	if err != nil {
		t.Fatal(err)
	}
	_, err = store.CreateGrant(db.Grant{SubjectType: db.SubjectTeam, SubjectID: db.PlatformTeamID, ProjectID: db.SampleProjectID, ServerID: server.ID, AllowedTools: []string{"rotate_secret"}, Environment: db.EnvironmentDev, Reason: "test", Enabled: true}, principal, "trace", nil)
	if err != nil {
		t.Fatal(err)
	}
	handler := NewServer(store, config.Load(5000), upstream).Handler()
	body := map[string]interface{}{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": map[string]interface{}{"name": "rotate_secret", "arguments": map[string]interface{}{"token": "secret-value"}}}
	challenge := postMCP(t, handler, "/mcp/critical", body)
	if challenge.Code != http.StatusOK || upstreamCalls != 0 || !bytes.Contains(challenge.Body.Bytes(), []byte("STEP_UP_REQUIRED")) {
		t.Fatalf("expected step-up challenge before upstream, calls=%d body=%s", upstreamCalls, challenge.Body.String())
	}
	var parsed mcp.Response
	if err := json.Unmarshal(challenge.Body.Bytes(), &parsed); err != nil {
		t.Fatal(err)
	}
	token, _ := parsed.Error.Data["stepUpToken"].(string)
	if token == "" {
		t.Fatalf("expected step-up token in response: %#v", parsed.Error.Data)
	}
	allowed := postMCPWithHeaders(t, handler, "/mcp/critical", body, map[string]string{"x-mcp-step-up-token": token})
	if allowed.Code != http.StatusOK || upstreamCalls != 1 {
		t.Fatalf("expected token to allow exactly one upstream call, status=%d calls=%d body=%s", allowed.Code, upstreamCalls, allowed.Body.String())
	}
	reused := postMCPWithHeaders(t, handler, "/mcp/critical", body, map[string]string{"x-mcp-step-up-token": token})
	if reused.Code != http.StatusOK || upstreamCalls != 1 || !bytes.Contains(reused.Body.Bytes(), []byte("STEP_UP_REQUIRED")) {
		t.Fatalf("expected consumed token to be rejected, calls=%d body=%s", upstreamCalls, reused.Body.String())
	}
	audit := store.ListAuditEvents(50, "", map[string]string{})
	auditJSON := mustJSONBytes(audit.Items)
	if bytes.Contains(auditJSON, []byte(token)) || bytes.Contains(auditJSON, []byte("secret-value")) {
		t.Fatalf("audit leaked step-up token or secret args: %s", string(auditJSON))
	}
}

func TestGatewayHotReloadsPersistedCatalog(t *testing.T) {
	path := filepath.Join(t.TempDir(), "store.json")
	gatewayStore := db.NewSeedStore()
	gatewayStore.UsePersistence(path)
	handler := NewServer(gatewayStore, config.Load(5000), nil).Handler()

	writerStore := db.NewSeedStore()
	writerStore.UsePersistence(path)
	principal := auth.MockAdmin()
	server, err := writerStore.CreateServer(db.MCPServer{Slug: "hot", DisplayName: "Hot", OwnerTeamID: db.PlatformTeamID, Environment: db.EnvironmentDev, Transport: db.TransportStreamableHTTP, Enabled: true, RiskLevel: db.RiskLow}, []db.MCPTool{{Name: "probe", Enabled: true, RiskLevel: db.RiskLow, InputSchema: map[string]interface{}{"type": "object"}}}, principal, "trace", nil)
	if err != nil {
		t.Fatal(err)
	}
	_, err = writerStore.CreateGrant(db.Grant{SubjectType: db.SubjectTeam, SubjectID: db.PlatformTeamID, ProjectID: db.SampleProjectID, ServerID: server.ID, AllowedTools: []string{"probe"}, Environment: db.EnvironmentDev, Reason: "hot", Enabled: true}, principal, "trace", nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := writerStore.Save(); err != nil {
		t.Fatalf("save writer store: %v", err)
	}

	recorder := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/mcp/hot", nil)
	req.Header.Set("authorization", "Bearer dev-admin-token")
	handler.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK || !bytes.Contains(recorder.Body.Bytes(), []byte("hot")) {
		t.Fatalf("expected hot-reloaded server, status=%d body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestGatewayCircuitBreakerHalfOpenAllowsProbe(t *testing.T) {
	upstreamCalls := 0
	upstream := fakeUpstream{call: func(ctx context.Context, server db.MCPServer, request mcp.Request, traceID string) (mcp.Response, int, error) {
		upstreamCalls++
		if upstreamCalls == 1 {
			return mcp.Response{}, 0, errors.New("UPSTREAM_ERROR")
		}
		return mcp.Result(request.ID, map[string]interface{}{"ok": true}), 200, nil
	}}
	store := db.NewSeedStore()
	principal := auth.MockAdmin()
	server, err := store.CreateServer(db.MCPServer{Slug: "flaky", DisplayName: "Flaky", OwnerTeamID: db.PlatformTeamID, Environment: db.EnvironmentDev, Transport: db.TransportStreamableHTTP, Enabled: true, RiskLevel: db.RiskLow}, []db.MCPTool{{Name: "probe", Enabled: true, RiskLevel: db.RiskLow, InputSchema: map[string]interface{}{"type": "object"}}}, principal, "trace", nil)
	if err != nil {
		t.Fatal(err)
	}
	_, _ = store.CreateGrant(db.Grant{SubjectType: db.SubjectTeam, SubjectID: db.PlatformTeamID, ProjectID: db.SampleProjectID, ServerID: server.ID, AllowedTools: []string{"probe"}, Environment: db.EnvironmentDev, Reason: "flaky", Enabled: true}, principal, "trace", nil)
	serverImpl := NewServer(store, config.Load(5000), upstream)
	serverImpl.breaker = NewCircuitBreaker(1, time.Millisecond)
	handler := serverImpl.Handler()
	body := map[string]interface{}{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": map[string]interface{}{"name": "probe", "arguments": map[string]interface{}{}}}
	first := postMCP(t, handler, "/mcp/flaky", body)
	if first.Code != http.StatusBadGateway {
		t.Fatalf("expected first failure, got %d body %s", first.Code, first.Body.String())
	}
	open := postMCP(t, handler, "/mcp/flaky", body)
	if open.Code != http.StatusServiceUnavailable || upstreamCalls != 1 {
		t.Fatalf("expected open circuit without upstream call, status=%d calls=%d body=%s", open.Code, upstreamCalls, open.Body.String())
	}
	time.Sleep(2 * time.Millisecond)
	halfOpen := postMCP(t, handler, "/mcp/flaky", body)
	if halfOpen.Code != http.StatusOK || upstreamCalls != 2 {
		t.Fatalf("expected half-open probe success, status=%d calls=%d body=%s", halfOpen.Code, upstreamCalls, halfOpen.Body.String())
	}
}

func TestGatewayUsesPerServerTimeout(t *testing.T) {
	deadlineWasPerServer := false
	upstream := fakeUpstream{call: func(ctx context.Context, server db.MCPServer, request mcp.Request, traceID string) (mcp.Response, int, error) {
		deadline, ok := ctx.Deadline()
		deadlineWasPerServer = ok && time.Until(deadline) < time.Second
		return mcp.Result(request.ID, map[string]interface{}{"ok": true}), 200, nil
	}}
	store := db.NewSeedStore()
	principal := auth.MockAdmin()
	server, err := store.CreateServer(db.MCPServer{Slug: "timeout", DisplayName: "Timeout", OwnerTeamID: db.PlatformTeamID, Environment: db.EnvironmentDev, Transport: db.TransportStreamableHTTP, Enabled: true, RiskLevel: db.RiskLow, TimeoutMS: 25}, []db.MCPTool{{Name: "probe", Enabled: true, RiskLevel: db.RiskLow, InputSchema: map[string]interface{}{"type": "object"}}}, principal, "trace", nil)
	if err != nil {
		t.Fatal(err)
	}
	_, _ = store.CreateGrant(db.Grant{SubjectType: db.SubjectTeam, SubjectID: db.PlatformTeamID, ProjectID: db.SampleProjectID, ServerID: server.ID, AllowedTools: []string{"probe"}, Environment: db.EnvironmentDev, Reason: "timeout", Enabled: true}, principal, "trace", nil)
	response := postMCP(t, NewServer(store, config.Load(5000), upstream).Handler(), "/mcp/timeout", map[string]interface{}{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": map[string]interface{}{"name": "probe", "arguments": map[string]interface{}{}}})
	if response.Code != http.StatusOK || !deadlineWasPerServer {
		t.Fatalf("expected per-server timeout context, status=%d body=%s deadlineWasPerServer=%v", response.Code, response.Body.String(), deadlineWasPerServer)
	}
}

func TestSecureUpstreamTransportDisablesProxy(t *testing.T) {
	transport, ok := secureUpstreamTransport().(*http.Transport)
	if !ok || transport.Proxy != nil {
		t.Fatalf("expected secure upstream transport to disable proxy, transport=%#v", transport)
	}
}

func postMCP(t *testing.T, handler http.Handler, path string, body map[string]interface{}) *httptest.ResponseRecorder {
	return postMCPWithHeaders(t, handler, path, body, nil)
}

func postMCPWithHeaders(t *testing.T, handler http.Handler, path string, body map[string]interface{}, headers map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	encoded, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(encoded))
	req.Header.Set("authorization", "Bearer dev-admin-token")
	req.Header.Set("content-type", "application/json")
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, req)
	return recorder
}
func mustJSONBytes(value interface{}) []byte { encoded, _ := json.Marshal(value); return encoded }

type fakeUpstream struct {
	call func(context.Context, db.MCPServer, mcp.Request, string) (mcp.Response, int, error)
}

func (f fakeUpstream) Call(ctx context.Context, server db.MCPServer, request mcp.Request, traceID string) (mcp.Response, int, error) {
	return f.call(ctx, server, request, traceID)
}

func gatewayTestJWT(t *testing.T, claims map[string]interface{}) string {
	t.Helper()
	headerJSON, _ := json.Marshal(map[string]interface{}{"alg": "HS256", "typ": "JWT"})
	claimsJSON, _ := json.Marshal(claims)
	signingInput := base64.RawURLEncoding.EncodeToString(headerJSON) + "." + base64.RawURLEncoding.EncodeToString(claimsJSON)
	mac := hmac.New(sha256.New, []byte("test-secret"))
	_, _ = mac.Write([]byte(signingInput))
	return signingInput + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}
