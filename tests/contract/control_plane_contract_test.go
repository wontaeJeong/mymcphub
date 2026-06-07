package contract

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/mcp-hub/mcp-hub/internal/config"
	"github.com/mcp-hub/mcp-hub/internal/controlplane"
	"github.com/mcp-hub/mcp-hub/internal/db"
	"github.com/mcp-hub/mcp-hub/internal/testutil"
)

func TestOpenAPIClientConfigExampleMatchesRuntimeShape(t *testing.T) {
	source, err := os.ReadFile(testutil.RepoRoot(t) + "/schemas/openapi/mcp-hub.openapi.yaml")
	if err != nil {
		t.Fatalf("read OpenAPI source: %v", err)
	}
	if !strings.Contains(string(source), "x-examples:") || !strings.Contains(string(source), "opencodeLocalSeed") {
		t.Fatalf("OpenAPI source is missing Lane G client-config examples")
	}

	server := controlplane.NewServer(db.NewSeedStore(), config.Load(4000))
	response := postJSON(t, server.Handler(), "/api/client-config/generate", map[string]interface{}{"client": "opencode", "serverId": db.K8sReadonlyID})
	if response.Code != http.StatusOK {
		t.Fatalf("expected client-config 200, got %d body %s", response.Code, response.Body.String())
	}
	var body struct {
		Client      string                 `json:"client"`
		Placeholder bool                   `json:"placeholder"`
		GatewayURL  string                 `json:"gatewayUrl"`
		Config      map[string]interface{} `json:"config"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode client-config response: %v", err)
	}
	if body.Client != "opencode" || body.Placeholder || body.GatewayURL != "http://localhost:5000/mcp/k8s-readonly" {
		t.Fatalf("unexpected client-config response: %#v", body)
	}
	if _, ok := body.Config["mcp"].(map[string]interface{}); !ok {
		t.Fatalf("generated opencode config missing mcp object: %#v", body.Config)
	}
}

func TestGeneratedWebClientBoundaryAndErrorEnvelope(t *testing.T) {
	generated, err := os.ReadFile(testutil.RepoRoot(t) + "/apps/web/lib/generated/mcp-hub-client.ts")
	if err != nil {
		t.Fatalf("read generated web client: %v", err)
	}
	for _, token := range []string{"generatedApiRequest", "GeneratedApiClientError", "getGeneratedApiBaseUrl"} {
		if !strings.Contains(string(generated), token) {
			t.Fatalf("generated web client missing %s", token)
		}
	}

	server := controlplane.NewServer(db.NewSeedStore(), config.Load(4000))
	response := postJSON(t, server.Handler(), "/api/client-config/generate", map[string]interface{}{"client": "unsupported", "serverId": db.K8sReadonlyID})
	if response.Code != http.StatusBadRequest {
		t.Fatalf("expected unsupported client 400, got %d body %s", response.Code, response.Body.String())
	}
	var body struct {
		Error struct {
			Code    string                 `json:"code"`
			Message string                 `json:"message"`
			Details map[string]interface{} `json:"details"`
		} `json:"error"`
		TraceID string `json:"traceId"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode error envelope: %v", err)
	}
	if body.Error.Code != "VALIDATION_ERROR" || body.Error.Message == "" || body.TraceID == "" {
		t.Fatalf("invalid machine-readable error envelope: %#v", body)
	}
	clients, ok := body.Error.Details["supportedClients"].([]interface{})
	if !ok || len(clients) != len(testutil.LocalSeedFixture(t).ClientProfiles) {
		t.Fatalf("error details missing supported clients: %#v", body.Error.Details)
	}
}

func postJSON(t *testing.T, handler http.Handler, path string, body map[string]interface{}) *httptest.ResponseRecorder {
	t.Helper()
	encoded, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	recorder := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(encoded))
	req.Header.Set("content-type", "application/json")
	handler.ServeHTTP(recorder, req)
	return recorder
}
