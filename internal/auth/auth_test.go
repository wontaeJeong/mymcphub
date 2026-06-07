package auth

import (
	"net/http"
	"testing"

	"github.com/mcp-hub/mcp-hub/internal/db"
)

func TestOIDCContextRequiresUserHeader(t *testing.T) {
	t.Setenv("MCP_AUTH_MODE", "oidc")
	principal := ContextFromHeaders(&http.Request{Header: http.Header{}})
	if principal.UserID != "" || principal.IsPlatformAdmin {
		t.Fatalf("expected anonymous non-admin principal, got %#v", principal)
	}
}

func TestOIDCContextMapsAdminHeaders(t *testing.T) {
	t.Setenv("MCP_AUTH_MODE", "oidc")
	request := &http.Request{Header: http.Header{}}
	request.Header.Set("x-user-id", "operator-1")
	request.Header.Set("x-roles", "platform_admin")
	request.Header.Set("x-team-ids", db.PlatformTeamID)
	principal := ContextFromHeaders(request)
	if principal.UserID != "operator-1" || !principal.IsPlatformAdmin || principal.TeamIDs[0] != db.PlatformTeamID {
		t.Fatalf("expected mapped platform admin, got %#v", principal)
	}
}

func TestOIDCModeDisablesMockBearerTokensByDefault(t *testing.T) {
	t.Setenv("MCP_AUTH_MODE", "oidc")
	request := &http.Request{Header: http.Header{}}
	request.Header.Set("authorization", "Bearer "+AdminToken)
	if _, ok := PrincipalFromBearer(request); ok {
		t.Fatal("expected mock bearer token to be rejected in oidc mode")
	}
}
