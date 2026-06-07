package e2e

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mcp-hub/mcp-hub/internal/auth"
	"github.com/mcp-hub/mcp-hub/internal/config"
	"github.com/mcp-hub/mcp-hub/internal/controlplane"
	"github.com/mcp-hub/mcp-hub/internal/db"
	"github.com/mcp-hub/mcp-hub/internal/gateway"
)

func TestGoCoreAPIGatewayE2E(t *testing.T) {
	store := db.NewSeedStore()
	api := httptest.NewServer(controlplane.NewServer(store, config.Load(4000)).Handler())
	defer api.Close()
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"jsonrpc": "2.0", "id": float64(7), "result": map[string]interface{}{"content": []interface{}{map[string]interface{}{"type": "text", "text": "e2e"}}}})
	}))
	defer upstream.Close()
	principal := auth.MockAdmin()
	server, err := store.CreateServer(db.MCPServer{Slug: "e2e", DisplayName: "E2E", OwnerTeamID: db.PlatformTeamID, Environment: db.EnvironmentDev, Transport: db.TransportStreamableHTTP, UpstreamURL: upstream.URL, Enabled: true, RiskLevel: db.RiskLow}, []db.MCPTool{{Name: "probe", Enabled: true, RiskLevel: db.RiskLow, InputSchema: map[string]interface{}{"type": "object", "properties": map[string]interface{}{}, "additionalProperties": false}}}, principal, "trace", nil)
	if err != nil {
		t.Fatal(err)
	}
	_, _ = store.CreateGrant(db.Grant{SubjectType: db.SubjectTeam, SubjectID: db.PlatformTeamID, ProjectID: db.SampleProjectID, ServerID: server.ID, AllowedTools: []string{"probe"}, Environment: db.EnvironmentDev, Reason: "e2e", Enabled: true}, principal, "trace", nil)
	gw := httptest.NewServer(gateway.NewServer(store, config.Load(5000), nil).Handler())
	defer gw.Close()

	resp, err := http.Get(api.URL + "/api/servers")
	if err != nil || resp.StatusCode != 200 {
		t.Fatalf("api servers failed: %v status %v", err, status(resp))
	}

	body, _ := json.Marshal(map[string]interface{}{"jsonrpc": "2.0", "id": 7, "method": "tools/call", "params": map[string]interface{}{"name": "probe", "arguments": map[string]interface{}{"message": "hello"}}})
	req, _ := http.NewRequest(http.MethodPost, gw.URL+"/mcp/e2e", bytes.NewReader(body))
	req.Header.Set("authorization", "Bearer dev-admin-token")
	req.Header.Set("content-type", "application/json")
	call, err := http.DefaultClient.Do(req)
	if err != nil || call.StatusCode != 200 {
		t.Fatalf("gateway call failed: %v status %v", err, status(call))
	}
}

func status(resp *http.Response) int {
	if resp == nil {
		return 0
	}
	return resp.StatusCode
}
