package auth

import (
	"crypto"
	"crypto/hmac"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/mcp-hub/mcp-hub/internal/db"
	"github.com/mcp-hub/mcp-hub/internal/telemetry"
)

const (
	AdminToken    = "dev-admin-token"
	ReadOnlyToken = "dev-readonly-token"
)

func TraceID(r *http.Request) string {
	if value := telemetry.TraceID(r.Context()); value != "" {
		return value
	}
	if value := strings.TrimSpace(r.Header.Get("x-trace-id")); value != "" {
		return value
	}
	if value := strings.TrimSpace(r.Header.Get("x-request-id")); value != "" {
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
		if os.Getenv("MCP_TRUSTED_AUTH_HEADERS") != "true" {
			principal, authErr := PrincipalFromBearerDetailed(r)
			if authErr == nil {
				return principal
			}
		}
		if !trustedOIDCHeaders(r) {
			return Anonymous()
		}
		roles := split(r.Header.Get("x-roles"))
		groups := split(r.Header.Get("x-groups"))
		userID := strings.TrimSpace(r.Header.Get("x-user-id"))
		if userID == "" {
			return Anonymous()
		}
		teams := split(r.Header.Get("x-team-ids"))
		issuer := getenv("OIDC_ISSUER_URL", "mock-auth")
		return db.AuthContext{UserID: userID, PrincipalType: readPrincipalType(r.Header.Get("x-principal-type")), Email: first(r.Header.Get("x-user-email"), userID), DisplayName: first(r.Header.Get("x-user-display-name"), userID), TeamIDs: teams, Teams: firstNonEmpty(split(r.Header.Get("x-teams")), teams), Groups: groups, Roles: roles, ClientID: first(r.Header.Get("x-client-id"), "oidc-client"), Issuer: issuer, Audience: getenv("OIDC_AUDIENCE", "mcp-hub"), RedirectURI: strings.TrimSpace(r.Header.Get("x-redirect-uri")), IsAdmin: contains(roles, "admin"), IsPlatformAdmin: contains(roles, "admin") || contains(roles, "platform_admin") || contains(groups, "platform-admins"), AuthSource: "oidc", TokenIssuer: issuer, ProjectID: getenv("MCP_PROJECT_ID", db.SampleProjectID)}
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
	principal, authErr := PrincipalFromBearerDetailed(r)
	return principal, authErr == nil
}

type BearerError struct {
	Status      int
	Error       string
	Code        string
	Description string
	Scope       string
}

func (e *BearerError) Challenge() string {
	if e == nil {
		return `Bearer realm="mcp-gateway"`
	}
	parts := []string{`Bearer realm="mcp-gateway"`}
	if e.Error != "" {
		parts = append(parts, fmt.Sprintf(`error=%q`, e.Error))
	}
	if e.Description != "" {
		parts = append(parts, fmt.Sprintf(`error_description=%q`, e.Description))
	}
	if e.Scope != "" {
		parts = append(parts, fmt.Sprintf(`scope=%q`, e.Scope))
	}
	return strings.Join(parts, ", ")
}

func PrincipalFromBearerDetailed(r *http.Request) (db.AuthContext, *BearerError) {
	value := r.Header.Get("authorization")
	if !strings.HasPrefix(value, "Bearer ") {
		return db.AuthContext{}, bearerError(http.StatusUnauthorized, "invalid_request", "AUTH_MISSING_BEARER_TOKEN", "Bearer token is required.", "")
	}
	token := strings.TrimSpace(strings.TrimPrefix(value, "Bearer "))
	if token == "" {
		return db.AuthContext{}, bearerError(http.StatusUnauthorized, "invalid_request", "AUTH_MISSING_BEARER_TOKEN", "Bearer token is required.", "")
	}
	if os.Getenv("MCP_AUTH_MODE") != "oidc" || os.Getenv("MCP_ALLOW_MOCK_TOKENS") == "true" {
		switch token {
		case AdminToken:
			principal := MockAdmin()
			principal.ClientID = "mcp-client"
			return principal, nil
		case ReadOnlyToken:
			return db.AuthContext{UserID: "readonly-user", PrincipalType: db.SubjectUser, Email: "readonly@example.com", DisplayName: "Read Only User", TeamIDs: []string{"readonly-team"}, Teams: []string{"readonly-team"}, Groups: []string{"readonly"}, Roles: []string{"reader"}, ClientID: "mcp-client", Issuer: "mock-auth", Audience: "mcp-hub", AuthSource: "mock", TokenIssuer: "mock-auth", ProjectID: db.SampleProjectID}, nil
		}
	}
	if os.Getenv("MCP_AUTH_MODE") != "oidc" {
		return db.AuthContext{}, bearerError(http.StatusUnauthorized, "invalid_token", "AUTH_INVALID_BEARER_TOKEN", "Bearer token is not recognized.", "")
	}
	principal, authErr := principalFromJWT(token, time.Now().UTC())
	if authErr != nil {
		return db.AuthContext{}, authErr
	}
	return principal, nil
}

func RequirePlatformAdmin(principal db.AuthContext) bool { return principal.IsPlatformAdmin }

func bearerError(status int, oauthError, code, description, scope string) *BearerError {
	return &BearerError{Status: status, Error: oauthError, Code: code, Description: description, Scope: scope}
}

type jwtHeader struct {
	Alg string `json:"alg"`
	Kid string `json:"kid"`
	Typ string `json:"typ"`
}

type jwksDocument struct {
	Keys []jwkKey `json:"keys"`
}

type jwkKey struct {
	Kty string `json:"kty"`
	Kid string `json:"kid"`
	Use string `json:"use"`
	Alg string `json:"alg"`
	N   string `json:"n"`
	E   string `json:"e"`
}

type cachedJWKS struct {
	keys      map[string]jwkKey
	expiresAt time.Time
}

var jwksCache = struct {
	sync.Mutex
	byURL map[string]cachedJWKS
}{byURL: map[string]cachedJWKS{}}

func principalFromJWT(token string, now time.Time) (db.AuthContext, *BearerError) {
	header, claims, signingInput, signature, err := parseJWT(token)
	if err != nil {
		return db.AuthContext{}, bearerError(http.StatusUnauthorized, "invalid_token", "AUTH_JWT_MALFORMED", "Bearer token must be a compact JWT.", "")
	}
	if err := verifyJWTSignature(header, signingInput, signature); err != nil {
		return db.AuthContext{}, bearerError(http.StatusUnauthorized, "invalid_token", "AUTH_JWT_SIGNATURE_INVALID", "JWT signature could not be verified.", "")
	}
	issuer := getenv("OIDC_ISSUER_URL", "mock-auth")
	if stringClaim(claims, "iss") != issuer {
		return db.AuthContext{}, bearerError(http.StatusUnauthorized, "invalid_token", "AUTH_JWT_ISSUER_INVALID", "JWT issuer is not trusted.", "")
	}
	audience := getenv("OIDC_AUDIENCE", "mcp-hub")
	if !audienceContains(claims["aud"], audience) {
		return db.AuthContext{}, bearerError(http.StatusUnauthorized, "invalid_token", "AUTH_JWT_AUDIENCE_INVALID", "JWT audience is not accepted.", "")
	}
	if exp, ok := numericClaim(claims, "exp"); !ok || now.Unix() >= exp {
		return db.AuthContext{}, bearerError(http.StatusUnauthorized, "invalid_token", "AUTH_JWT_EXPIRED", "JWT is expired or missing exp.", "")
	}
	if nbf, ok := numericClaim(claims, "nbf"); ok && now.Unix() < nbf {
		return db.AuthContext{}, bearerError(http.StatusUnauthorized, "invalid_token", "AUTH_JWT_NOT_YET_VALID", "JWT is not valid yet.", "")
	}
	requiredScope := getenv("OIDC_REQUIRED_SCOPE", "mcp:gateway")
	scopes := scopesFromClaims(claims)
	if requiredScope != "" && !contains(scopes, requiredScope) {
		return db.AuthContext{}, bearerError(http.StatusForbidden, "insufficient_scope", "AUTH_JWT_SCOPE_MISSING", "JWT is missing the required Gateway scope.", requiredScope)
	}
	userID := first(stringClaim(claims, "sub"), stringClaim(claims, "user_id"))
	if userID == "" {
		return db.AuthContext{}, bearerError(http.StatusUnauthorized, "invalid_token", "AUTH_JWT_SUBJECT_MISSING", "JWT subject is required.", "")
	}
	roles := stringListClaim(claims, "roles")
	if len(roles) == 0 {
		roles = stringListClaim(claims, "role")
	}
	groups := stringListClaim(claims, "groups")
	teams := firstNonEmpty(stringListClaim(claims, "team_ids"), stringListClaim(claims, "teams"))
	clientID := first(stringClaim(claims, "client_id"), stringClaim(claims, "azp"))
	if clientID == "" {
		return db.AuthContext{}, bearerError(http.StatusUnauthorized, "invalid_token", "AUTH_JWT_CLIENT_ID_MISSING", "JWT client_id or azp is required.", "")
	}
	projectID := first(stringClaim(claims, "project_id"), getenv("MCP_PROJECT_ID", db.SampleProjectID))
	principalType := readPrincipalType(stringClaim(claims, "principal_type"))
	return db.AuthContext{UserID: userID, PrincipalType: principalType, Email: first(stringClaim(claims, "email"), userID), DisplayName: first(stringClaim(claims, "name"), userID), TeamIDs: teams, Teams: teams, Groups: groups, Roles: append(roles, scopes...), ClientID: clientID, Issuer: issuer, Audience: audience, RedirectURI: stringClaim(claims, "redirect_uri"), IsAdmin: contains(roles, "admin") || contains(roles, "platform_admin"), IsPlatformAdmin: contains(roles, "admin") || contains(roles, "platform_admin") || contains(groups, "platform-admins"), AuthSource: "oidc", TokenIssuer: issuer, ProjectID: projectID}, nil
}

func parseJWT(token string) (jwtHeader, map[string]interface{}, []byte, []byte, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return jwtHeader{}, nil, nil, nil, errors.New("compact JWT must contain three parts")
	}
	headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return jwtHeader{}, nil, nil, nil, err
	}
	claimBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return jwtHeader{}, nil, nil, nil, err
	}
	signature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return jwtHeader{}, nil, nil, nil, err
	}
	var header jwtHeader
	if err := json.Unmarshal(headerBytes, &header); err != nil {
		return jwtHeader{}, nil, nil, nil, err
	}
	var claims map[string]interface{}
	if err := json.Unmarshal(claimBytes, &claims); err != nil {
		return jwtHeader{}, nil, nil, nil, err
	}
	return header, claims, []byte(parts[0] + "." + parts[1]), signature, nil
}

func verifyJWTSignature(header jwtHeader, signingInput, signature []byte) error {
	switch header.Alg {
	case "HS256":
		secret := os.Getenv("OIDC_HS256_SECRET")
		if secret == "" {
			return errors.New("OIDC_HS256_SECRET is required for HS256 JWTs")
		}
		mac := hmac.New(sha256.New, []byte(secret))
		_, _ = mac.Write(signingInput)
		if !hmac.Equal(signature, mac.Sum(nil)) {
			return errors.New("invalid HS256 signature")
		}
		return nil
	case "RS256":
		key, err := jwkForKeyID(header.Kid)
		if err != nil {
			return err
		}
		digest := sha256.Sum256(signingInput)
		return rsa.VerifyPKCS1v15(key, crypto.SHA256, digest[:], signature)
	default:
		return fmt.Errorf("unsupported JWT alg %q", header.Alg)
	}
}

func jwkForKeyID(kid string) (*rsa.PublicKey, error) {
	url := strings.TrimSpace(os.Getenv("OIDC_JWKS_URL"))
	if url == "" {
		return nil, errors.New("OIDC_JWKS_URL is required for RS256 JWTs")
	}
	keys, err := loadJWKS(url)
	if err != nil {
		return nil, err
	}
	key, ok := keys[kid]
	if !ok && kid == "" && len(keys) == 1 {
		for _, only := range keys {
			key = only
			ok = true
		}
	}
	if !ok {
		return nil, errors.New("JWK key id not found")
	}
	n, err := base64.RawURLEncoding.DecodeString(key.N)
	if err != nil {
		return nil, err
	}
	eBytes, err := base64.RawURLEncoding.DecodeString(key.E)
	if err != nil {
		return nil, err
	}
	e := 0
	for _, b := range eBytes {
		e = e<<8 + int(b)
	}
	if e == 0 {
		return nil, errors.New("invalid JWK exponent")
	}
	return &rsa.PublicKey{N: new(big.Int).SetBytes(n), E: e}, nil
}

func loadJWKS(url string) (map[string]jwkKey, error) {
	jwksCache.Lock()
	if cached, ok := jwksCache.byURL[url]; ok && time.Now().UTC().Before(cached.expiresAt) {
		keys := cached.keys
		jwksCache.Unlock()
		return keys, nil
	}
	jwksCache.Unlock()
	client := http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return nil, fmt.Errorf("JWKS endpoint returned HTTP %d", resp.StatusCode)
	}
	var document jwksDocument
	if err := json.NewDecoder(resp.Body).Decode(&document); err != nil {
		return nil, err
	}
	keys := map[string]jwkKey{}
	for _, key := range document.Keys {
		if key.Kty == "RSA" && key.N != "" && key.E != "" {
			keys[key.Kid] = key
		}
	}
	jwksCache.Lock()
	jwksCache.byURL[url] = cachedJWKS{keys: keys, expiresAt: time.Now().UTC().Add(5 * time.Minute)}
	jwksCache.Unlock()
	return keys, nil
}

func audienceContains(value interface{}, expected string) bool {
	switch typed := value.(type) {
	case string:
		return typed == expected
	case []interface{}:
		for _, item := range typed {
			if text, ok := item.(string); ok && text == expected {
				return true
			}
		}
	}
	return false
}

func numericClaim(claims map[string]interface{}, key string) (int64, bool) {
	switch value := claims[key].(type) {
	case float64:
		return int64(value), true
	case json.Number:
		parsed, err := value.Int64()
		return parsed, err == nil
	default:
		return 0, false
	}
}

func stringClaim(claims map[string]interface{}, key string) string {
	if value, ok := claims[key].(string); ok {
		return strings.TrimSpace(value)
	}
	return ""
}

func stringListClaim(claims map[string]interface{}, key string) []string {
	switch value := claims[key].(type) {
	case string:
		return split(value)
	case []interface{}:
		out := make([]string, 0, len(value))
		for _, item := range value {
			if text, ok := item.(string); ok && strings.TrimSpace(text) != "" {
				out = append(out, strings.TrimSpace(text))
			}
		}
		return out
	case []string:
		return value
	default:
		return nil
	}
}

func scopesFromClaims(claims map[string]interface{}) []string {
	scopes := scopeListClaim(claims, "scope")
	for _, scope := range stringListClaim(claims, "scp") {
		if !contains(scopes, scope) {
			scopes = append(scopes, scope)
		}
	}
	return scopes
}

func scopeListClaim(claims map[string]interface{}, key string) []string {
	value := stringClaim(claims, key)
	if value == "" {
		return stringListClaim(claims, key)
	}
	return strings.Fields(strings.ReplaceAll(value, ",", " "))
}

func trustedOIDCHeaders(r *http.Request) bool {
	if os.Getenv("MCP_TRUSTED_AUTH_HEADERS") == "true" {
		return true
	}
	expected := strings.TrimSpace(os.Getenv("MCP_TRUSTED_AUTH_HEADER_TOKEN"))
	if expected != "" {
		actual := strings.TrimSpace(r.Header.Get("x-auth-proxy-token"))
		if actual != "" && len(actual) == len(expected) && subtle.ConstantTimeCompare([]byte(actual), []byte(expected)) == 1 {
			return true
		}
	}
	secret := strings.TrimSpace(os.Getenv("MCP_TRUSTED_PROXY_SECRET"))
	if secret == "" {
		return false
	}
	header := getenv("MCP_TRUSTED_PROXY_HEADER", "x-mcp-hub-trusted-proxy")
	value := strings.TrimSpace(r.Header.Get(header))
	return value != "" && len(value) == len(secret) && subtle.ConstantTimeCompare([]byte(value), []byte(secret)) == 1
}

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
