package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

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
	t.Setenv("MCP_TRUSTED_AUTH_HEADERS", "true")
	t.Setenv("MCP_TRUSTED_AUTH_HEADER_TOKEN", "trusted-proxy-token")
	request := &http.Request{Header: http.Header{}}
	request.Header.Set("x-auth-proxy-token", "trusted-proxy-token")
	request.Header.Set("x-user-id", "operator-1")
	request.Header.Set("x-roles", "platform_admin")
	request.Header.Set("x-team-ids", db.PlatformTeamID)
	principal := ContextFromHeaders(request)
	if principal.UserID != "operator-1" || !principal.IsPlatformAdmin || principal.TeamIDs[0] != db.PlatformTeamID {
		t.Fatalf("expected mapped platform admin, got %#v", principal)
	}
}

func TestOIDCContextRejectsUntrustedAdminHeaders(t *testing.T) {
	t.Setenv("MCP_AUTH_MODE", "oidc")
	t.Setenv("MCP_TRUSTED_AUTH_HEADER_TOKEN", "trusted-proxy-token")
	request := &http.Request{Header: http.Header{}}
	request.Header.Set("x-user-id", "operator-1")
	request.Header.Set("x-roles", "platform_admin")
	principal := ContextFromHeaders(request)
	if principal.UserID != "" || principal.IsPlatformAdmin {
		t.Fatalf("expected untrusted headers to map to anonymous, got %#v", principal)
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

func TestOIDCBearerJWTValidatesAndMapsPrincipal(t *testing.T) {
	t.Setenv("MCP_AUTH_MODE", "oidc")
	t.Setenv("OIDC_HS256_SECRET", "test-secret")
	t.Setenv("OIDC_ISSUER_URL", "https://issuer.example")
	t.Setenv("OIDC_AUDIENCE", "mcp-hub")
	t.Setenv("OIDC_REQUIRED_SCOPE", "mcp:gateway")
	token := testJWT(t, map[string]interface{}{"iss": "https://issuer.example", "aud": []string{"mcp-hub"}, "exp": time.Now().Add(time.Hour).Unix(), "sub": "user-1", "client_id": "client-1", "scope": "openid mcp:gateway", "roles": []string{"platform_admin"}, "team_ids": []string{db.PlatformTeamID}})
	request := &http.Request{Header: http.Header{}}
	request.Header.Set("authorization", "Bearer "+token)
	principal, authErr := PrincipalFromBearerDetailed(request)
	if authErr != nil {
		t.Fatalf("expected valid JWT, got %#v", authErr)
	}
	if principal.UserID != "user-1" || principal.ClientID != "client-1" || !principal.IsPlatformAdmin || principal.TeamIDs[0] != db.PlatformTeamID {
		t.Fatalf("unexpected principal mapping: %#v", principal)
	}
}

func TestOIDCBearerJWTRequiresScope(t *testing.T) {
	t.Setenv("MCP_AUTH_MODE", "oidc")
	t.Setenv("OIDC_HS256_SECRET", "test-secret")
	t.Setenv("OIDC_ISSUER_URL", "https://issuer.example")
	t.Setenv("OIDC_AUDIENCE", "mcp-hub")
	t.Setenv("OIDC_REQUIRED_SCOPE", "mcp:gateway")
	token := testJWT(t, map[string]interface{}{"iss": "https://issuer.example", "aud": "mcp-hub", "exp": time.Now().Add(time.Hour).Unix(), "sub": "user-1", "scope": "openid"})
	request := &http.Request{Header: http.Header{}}
	request.Header.Set("authorization", "Bearer "+token)
	_, authErr := PrincipalFromBearerDetailed(request)
	if authErr == nil || authErr.Status != http.StatusForbidden || !strings.Contains(authErr.Challenge(), "insufficient_scope") {
		t.Fatalf("expected insufficient scope challenge, got %#v", authErr)
	}
}

func TestOIDCBearerJWTRequiresClientID(t *testing.T) {
	t.Setenv("MCP_AUTH_MODE", "oidc")
	t.Setenv("OIDC_HS256_SECRET", "test-secret")
	t.Setenv("OIDC_ISSUER_URL", "https://issuer.example")
	t.Setenv("OIDC_AUDIENCE", "mcp-hub")
	t.Setenv("OIDC_REQUIRED_SCOPE", "mcp:gateway")
	token := testJWT(t, map[string]interface{}{"iss": "https://issuer.example", "aud": "mcp-hub", "exp": time.Now().Add(time.Hour).Unix(), "sub": "user-1", "scope": "mcp:gateway"})
	request := &http.Request{Header: http.Header{}}
	request.Header.Set("authorization", "Bearer "+token)
	_, authErr := PrincipalFromBearerDetailed(request)
	if authErr == nil || authErr.Code != "AUTH_JWT_CLIENT_ID_MISSING" {
		t.Fatalf("expected missing client id error, got %#v", authErr)
	}
}

func testJWT(t *testing.T, claims map[string]interface{}) string {
	t.Helper()
	header := map[string]interface{}{"alg": "HS256", "typ": "JWT"}
	headerJSON, _ := json.Marshal(header)
	claimsJSON, _ := json.Marshal(claims)
	signingInput := base64.RawURLEncoding.EncodeToString(headerJSON) + "." + base64.RawURLEncoding.EncodeToString(claimsJSON)
	mac := hmac.New(sha256.New, []byte("test-secret"))
	_, _ = mac.Write([]byte(signingInput))
	return signingInput + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}
