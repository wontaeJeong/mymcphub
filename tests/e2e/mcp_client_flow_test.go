package e2e

import (
	"net/http"
	"strings"
	"testing"

	"github.com/mcp-hub/mcp-hub/internal/auth"
	"github.com/mcp-hub/mcp-hub/internal/db"
	"github.com/mcp-hub/mcp-hub/internal/testutil"
)

func TestMCPClientFlowInitializeListCallAndDeny(t *testing.T) {
	store := db.NewSeedStore()
	server := testutil.NewGrantedLocalServer(t, store, "lane-g-e2e", []string{"fixture_echo"}, "")
	_, err := store.CreateGrant(db.Grant{SubjectType: db.SubjectTeam, SubjectID: "readonly-team", ProjectID: db.SampleProjectID, ServerID: server.ID, AllowedTools: []string{"other_fixture_tool"}, Environment: db.EnvironmentDev, Reason: "connect-only policy deny fixture", Enabled: true}, db.AuthContext{UserID: db.AdminUserID}, "test-fixture", nil)
	if err != nil {
		t.Fatal(err)
	}
	handler := testutil.NewGatewayHandler(store, nil)

	initialize := testutil.PostMCP(t, handler, "/mcp/lane-g-e2e", auth.AdminToken, map[string]interface{}{"jsonrpc": "2.0", "id": 1, "method": "initialize"})
	if initialize.Code != http.StatusOK {
		t.Fatalf("initialize status %d body %s", initialize.Code, initialize.Body.String())
	}
	if !containsBody(initialize.Body.String(), "protocolVersion") {
		t.Fatalf("initialize did not return protocol metadata: %s", initialize.Body.String())
	}

	initialized := testutil.PostMCP(t, handler, "/mcp/lane-g-e2e", auth.AdminToken, map[string]interface{}{"jsonrpc": "2.0", "method": "notifications/initialized"})
	if initialized.Code != http.StatusAccepted {
		t.Fatalf("initialized notification status %d body %s", initialized.Code, initialized.Body.String())
	}

	tools := testutil.PostMCP(t, handler, "/mcp/lane-g-e2e", auth.AdminToken, map[string]interface{}{"jsonrpc": "2.0", "id": 2, "method": "tools/list"})
	if tools.Code != http.StatusOK || !containsBody(tools.Body.String(), "fixture_echo") {
		t.Fatalf("tools/list failed status %d body %s", tools.Code, tools.Body.String())
	}

	call := testutil.PostMCP(t, handler, "/mcp/lane-g-e2e", auth.AdminToken, map[string]interface{}{"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": map[string]interface{}{"name": "fixture_echo", "arguments": map[string]interface{}{"message": "hello"}}})
	if call.Code != http.StatusOK || !containsBody(call.Body.String(), "local tool call completed") {
		t.Fatalf("tools/call failed status %d body %s", call.Code, call.Body.String())
	}

	missingAuth := testutil.PostMCP(t, handler, "/mcp/lane-g-e2e", "", map[string]interface{}{"jsonrpc": "2.0", "id": 4, "method": "tools/list"})
	if missingAuth.Code != http.StatusUnauthorized {
		t.Fatalf("expected auth deny 401, got %d", missingAuth.Code)
	}

	policyDeny := testutil.PostMCP(t, handler, "/mcp/lane-g-e2e", auth.ReadOnlyToken, map[string]interface{}{"jsonrpc": "2.0", "id": 5, "method": "tools/call", "params": map[string]interface{}{"name": "fixture_echo", "arguments": map[string]interface{}{}}})
	if policyDeny.Code != http.StatusOK || !containsBody(policyDeny.Body.String(), "not granted") {
		t.Fatalf("expected policy deny JSON-RPC error, got status %d body %s", policyDeny.Code, policyDeny.Body.String())
	}
}

func containsBody(body, needle string) bool {
	return strings.Contains(body, needle)
}
