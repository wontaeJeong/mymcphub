package security

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mcp-hub/mcp-hub/internal/auth"
	"github.com/mcp-hub/mcp-hub/internal/config"
	"github.com/mcp-hub/mcp-hub/internal/db"
	"github.com/mcp-hub/mcp-hub/internal/gateway"
)

func TestGatewaySecurityNegativeCases(t *testing.T) {
	store := db.NewSeedStore()
	principal := auth.MockAdmin()
	server, err := store.CreateServer(db.MCPServer{Slug: "blocked", DisplayName: "Blocked", OwnerTeamID: db.PlatformTeamID, Environment: db.EnvironmentDev, Transport: db.TransportStreamableHTTP, UpstreamURL: "http://169.254.169.254/latest", Enabled: true, RiskLevel: db.RiskLow}, []db.MCPTool{{Name: "probe", Enabled: true, RiskLevel: db.RiskLow, InputSchema: map[string]interface{}{"type": "object", "properties": map[string]interface{}{}, "additionalProperties": false}}}, principal, "trace", nil)
	if err != nil {
		t.Fatal(err)
	}
	_, _ = store.CreateGrant(db.Grant{SubjectType: db.SubjectTeam, SubjectID: db.PlatformTeamID, ProjectID: db.SampleProjectID, ServerID: server.ID, AllowedTools: []string{"probe"}, Environment: db.EnvironmentDev, Reason: "security", Enabled: true}, principal, "trace", nil)
	handler := gateway.NewServer(store, config.Load(5000), nil).Handler()

	unauth := httptest.NewRecorder()
	handler.ServeHTTP(unauth, httptest.NewRequest(http.MethodPost, "/mcp/blocked", bytes.NewReader([]byte(`{"jsonrpc":"2.0","id":1,"method":"tools/list"}`))))
	if unauth.Code != http.StatusUnauthorized {
		t.Fatalf("expected unauthenticated tools/list deny, got %d", unauth.Code)
	}

	body, _ := json.Marshal(map[string]interface{}{"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": map[string]interface{}{"name": "probe", "arguments": map[string]interface{}{}}})
	req := httptest.NewRequest(http.MethodPost, "/mcp/blocked", bytes.NewReader(body))
	req.Header.Set("authorization", "Bearer dev-admin-token")
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusBadGateway {
		t.Fatalf("expected SSRF-like upstream URL blocked before upstream call, got %d body %s", recorder.Code, recorder.Body.String())
	}
}
