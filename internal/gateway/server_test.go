package gateway

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mcp-hub/mcp-hub/internal/auth"
	"github.com/mcp-hub/mcp-hub/internal/config"
	"github.com/mcp-hub/mcp-hub/internal/db"
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
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/mcp/echo", bytes.NewReader([]byte(`{"jsonrpc":"2.0","id":1,"method":"tools/list"}`))))
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", recorder.Code)
	}
}

func postMCP(t *testing.T, handler http.Handler, path string, body map[string]interface{}) *httptest.ResponseRecorder {
	t.Helper()
	encoded, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(encoded))
	req.Header.Set("authorization", "Bearer dev-admin-token")
	req.Header.Set("content-type", "application/json")
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, req)
	return recorder
}
func mustJSONBytes(value interface{}) []byte { encoded, _ := json.Marshal(value); return encoded }
