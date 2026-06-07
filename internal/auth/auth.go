package auth

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"os"
	"strings"

	"github.com/mcp-hub/mcp-hub/internal/db"
)

const (
	AdminToken    = "dev-admin-token"
	ReadOnlyToken = "dev-readonly-token"
)

func TraceID(r *http.Request) string {
	if value := strings.TrimSpace(r.Header.Get("x-trace-id")); value != "" {
		return value
	}
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return db.NewID()
	}
	return hex.EncodeToString(b)
}

func ContextFromHeaders(r *http.Request) db.AuthContext {
	mode := os.Getenv("MCP_AUTH_MODE")
	if mode == "oidc" {
		roles := split(r.Header.Get("x-roles"))
		groups := split(r.Header.Get("x-groups"))
		userID := strings.TrimSpace(r.Header.Get("x-user-id"))
		if userID == "" {
			return Anonymous()
		}
		teams := split(r.Header.Get("x-team-ids"))
		issuer := getenv("OIDC_ISSUER_URL", "mock-auth")
		return db.AuthContext{UserID: userID, PrincipalType: readPrincipalType(r.Header.Get("x-principal-type")), Email: first(r.Header.Get("x-user-email"), userID), DisplayName: first(r.Header.Get("x-user-display-name"), userID), TeamIDs: teams, Teams: firstNonEmpty(split(r.Header.Get("x-teams")), teams), Groups: groups, Roles: roles, ClientID: first(r.Header.Get("x-client-id"), "oidc-client"), Issuer: issuer, Audience: getenv("OIDC_AUDIENCE", "mcp-hub"), IsAdmin: contains(roles, "admin"), IsPlatformAdmin: contains(roles, "admin") || contains(roles, "platform_admin") || contains(groups, "platform-admins"), AuthSource: "oidc", TokenIssuer: issuer, ProjectID: getenv("MCP_PROJECT_ID", db.SampleProjectID)}
	}
	return MockAdmin()
}

func Anonymous() db.AuthContext {
	return db.AuthContext{PrincipalType: db.SubjectUser, AuthSource: "anonymous", ProjectID: getenv("MCP_PROJECT_ID", db.SampleProjectID)}
}

func MockAdmin() db.AuthContext {
	return db.AuthContext{UserID: db.AdminUserID, PrincipalType: db.SubjectUser, Email: "admin@example.com", DisplayName: "Admin User", TeamIDs: []string{db.PlatformTeamID}, Teams: []string{db.PlatformTeamID}, Groups: []string{"platform"}, Roles: []string{"admin"}, ClientID: "local-dev-client", Issuer: "mock-auth", Audience: "mcp-hub", IsAdmin: true, IsPlatformAdmin: true, AuthSource: "mock", TokenIssuer: "mock-auth", ProjectID: db.SampleProjectID}
}

func PrincipalFromBearer(r *http.Request) (db.AuthContext, bool) {
	if os.Getenv("MCP_AUTH_MODE") == "oidc" && os.Getenv("MCP_ALLOW_MOCK_TOKENS") != "true" {
		return db.AuthContext{}, false
	}
	value := r.Header.Get("authorization")
	if !strings.HasPrefix(value, "Bearer ") {
		return db.AuthContext{}, false
	}
	switch strings.TrimSpace(strings.TrimPrefix(value, "Bearer ")) {
	case AdminToken:
		principal := MockAdmin()
		principal.ClientID = "mcp-client"
		return principal, true
	case ReadOnlyToken:
		return db.AuthContext{UserID: "readonly-user", PrincipalType: db.SubjectUser, Email: "readonly@example.com", DisplayName: "Read Only User", TeamIDs: []string{"readonly-team"}, Teams: []string{"readonly-team"}, Groups: []string{"readonly"}, Roles: []string{"reader"}, ClientID: "mcp-client", Issuer: "mock-auth", Audience: "mcp-hub", AuthSource: "mock", TokenIssuer: "mock-auth", ProjectID: db.SampleProjectID}, true
	default:
		return db.AuthContext{}, false
	}
}

func RequirePlatformAdmin(principal db.AuthContext) bool { return principal.IsPlatformAdmin }

func split(value string) []string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}
func first(value, fallback string) string {
	if strings.TrimSpace(value) != "" {
		return strings.TrimSpace(value)
	}
	return fallback
}
func getenv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
func contains(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}
func firstNonEmpty(values, fallback []string) []string {
	if len(values) > 0 {
		return values
	}
	return fallback
}
func readPrincipalType(value string) db.GrantSubjectType {
	switch value {
	case "team":
		return db.SubjectTeam
	case "service_account":
		return db.SubjectServiceAccount
	default:
		return db.SubjectUser
	}
}
