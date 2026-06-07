package testutil

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/mcp-hub/mcp-hub/internal/auth"
	"github.com/mcp-hub/mcp-hub/internal/config"
	"github.com/mcp-hub/mcp-hub/internal/db"
	"github.com/mcp-hub/mcp-hub/internal/gateway"
)

const (
	FixtureLocalSeed    = "local-seed.json"
	FixtureMockOIDC     = "mock-oidc.json"
	FixtureMockUpstream = "mock-mcp-upstream.json"
)

type LocalSeed struct {
	Users          []FixtureUser    `json:"users"`
	Teams          []FixtureTeam    `json:"teams"`
	Projects       []FixtureProject `json:"projects"`
	Servers        []FixtureServer  `json:"servers"`
	Grants         []db.Grant       `json:"grants"`
	ClientProfiles []string         `json:"clientProfiles"`
}

type FixtureUser struct {
	ID          string   `json:"id"`
	Email       string   `json:"email"`
	DisplayName string   `json:"displayName"`
	Roles       []string `json:"roles"`
	MockToken   string   `json:"mockToken"`
}

type FixtureTeam struct {
	ID          string `json:"id"`
	Slug        string `json:"slug"`
	DisplayName string `json:"displayName"`
}

type FixtureProject struct {
	ID          string `json:"id"`
	Slug        string `json:"slug"`
	DisplayName string `json:"displayName"`
	OwnerTeamID string `json:"ownerTeamId"`
}

type FixtureServer struct {
	ID          string       `json:"id"`
	Slug        string       `json:"slug"`
	DisplayName string       `json:"displayName"`
	Environment string       `json:"environment"`
	Transport   string       `json:"transport"`
	UpstreamURL string       `json:"upstreamUrl"`
	RiskLevel   string       `json:"riskLevel"`
	Tools       []db.MCPTool `json:"tools"`
}

type MockOIDC struct {
	Issuer   string        `json:"issuer"`
	Audience string        `json:"audience"`
	JWKSPath string        `json:"jwksPath"`
	Users    []FixtureOIDC `json:"users"`
}

type FixtureOIDC struct {
	Subject string   `json:"sub"`
	Email   string   `json:"email"`
	Groups  []string `json:"groups"`
	Roles   []string `json:"roles"`
}

func RepoRoot(t testing.TB) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("resolve repo root")
	}
	return filepath.Clean(filepath.Join(filepath.Dir(file), "..", ".."))
}

func FixturePath(t testing.TB, name string) string {
	t.Helper()
	return filepath.Join(RepoRoot(t), "tests", "fixtures", name)
}

func LoadFixture[T any](t testing.TB, name string) T {
	t.Helper()
	data := readFile(t, FixturePath(t, name))
	var out T
	if err := json.Unmarshal(data, &out); err != nil {
		t.Fatalf("decode fixture %s: %v", name, err)
	}
	return out
}

func LocalSeedFixture(t testing.TB) LocalSeed {
	t.Helper()
	return LoadFixture[LocalSeed](t, FixtureLocalSeed)
}

func NewMockMCPUpstream(t testing.TB, result map[string]interface{}) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("expected POST to mock MCP upstream, got %s", r.Method)
		}
		var request struct {
			ID interface{} `json:"id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Fatalf("decode mock MCP request: %v", err)
		}
		writeJSON(t, w, map[string]interface{}{"jsonrpc": "2.0", "id": request.ID, "result": result})
	}))
}

func NewMockOIDCServer(t testing.TB) *httptest.Server {
	t.Helper()
	fixture := LoadFixture[MockOIDC](t, FixtureMockOIDC)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/.well-known/openid-configuration":
			writeJSON(t, w, map[string]interface{}{"issuer": fixture.Issuer, "audience": fixture.Audience, "jwks_uri": "mock-auth" + fixture.JWKSPath})
		case fixture.JWKSPath:
			writeJSON(t, w, map[string]interface{}{"keys": []interface{}{}})
		default:
			http.NotFound(w, r)
		}
	}))
	return server
}

func NewGrantedLocalServer(t testing.TB, store *db.Store, slug string, toolNames []string, upstreamURL string) db.MCPServer {
	t.Helper()
	principal := auth.MockAdmin()
	tools := make([]db.MCPTool, 0, len(toolNames))
	for _, name := range toolNames {
		tools = append(tools, db.MCPTool{Name: name, Enabled: true, RiskLevel: db.RiskLow, InputSchema: EmptyInputSchema()})
	}
	server, err := store.CreateServer(db.MCPServer{Slug: slug, DisplayName: slug, OwnerTeamID: db.PlatformTeamID, Environment: db.EnvironmentDev, Transport: db.TransportStreamableHTTP, UpstreamURL: upstreamURL, Enabled: true, RiskLevel: db.RiskLow}, tools, principal, "test-fixture", nil)
	if err != nil {
		t.Fatalf("create fixture server: %v", err)
	}
	_, err = store.CreateGrant(db.Grant{SubjectType: db.SubjectTeam, SubjectID: db.PlatformTeamID, ProjectID: db.SampleProjectID, ServerID: server.ID, AllowedTools: toolNames, Environment: db.EnvironmentDev, Reason: "test fixture grant", Enabled: true}, principal, "test-fixture", nil)
	if err != nil {
		t.Fatalf("create fixture grant: %v", err)
	}
	return server
}

func NewGatewayHandler(store *db.Store, upstream gateway.Upstream) http.Handler {
	return gateway.NewServer(store, config.Load(5000), upstream).Handler()
}

func PostMCP(t testing.TB, handler http.Handler, path string, token string, body map[string]interface{}) *httptest.ResponseRecorder {
	t.Helper()
	encoded, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("encode MCP request: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(encoded))
	req.Header.Set("content-type", "application/json")
	if token != "" {
		req.Header.Set("authorization", "Bearer "+token)
	}
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, req)
	return recorder
}

func PostMCPWithCanceledContext(t testing.TB, handler http.Handler, path string, token string, body map[string]interface{}) *httptest.ResponseRecorder {
	t.Helper()
	encoded, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("encode MCP request: %v", err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(encoded)).WithContext(ctx)
	req.Header.Set("content-type", "application/json")
	if token != "" {
		req.Header.Set("authorization", "Bearer "+token)
	}
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, req)
	return recorder
}

func EmptyInputSchema() map[string]interface{} {
	return map[string]interface{}{"type": "object", "properties": map[string]interface{}{}, "additionalProperties": false}
}

func DecodeJSON[T any](t testing.TB, data []byte) T {
	t.Helper()
	var out T
	if err := json.Unmarshal(data, &out); err != nil {
		t.Fatalf("decode json: %v body=%s", err, string(data))
	}
	return out
}

func readFile(t testing.TB, path string) []byte {
	t.Helper()
	data, err := osReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return data
}

func writeJSON(t testing.TB, w http.ResponseWriter, value interface{}) {
	t.Helper()
	w.Header().Set("content-type", "application/json")
	if err := json.NewEncoder(w).Encode(value); err != nil {
		t.Fatalf("write json: %v", err)
	}
}

var osReadFile = func(name string) ([]byte, error) { return os.ReadFile(name) }
