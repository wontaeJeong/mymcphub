package e2e

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mcp-hub/mcp-hub/internal/config"
	"github.com/mcp-hub/mcp-hub/internal/controlplane"
	"github.com/mcp-hub/mcp-hub/internal/db"
	"github.com/mcp-hub/mcp-hub/internal/testutil"
)

func TestClientConfigCompatibilityMatrix(t *testing.T) {
	api := controlplane.NewServer(db.NewSeedStore(), config.Load(4000)).Handler()
	fixture := testutil.LocalSeedFixture(t)
	for _, client := range fixture.ClientProfiles {
		client := client
		t.Run(client, func(t *testing.T) {
			response := postClientConfig(t, api, client)
			if response.Code != http.StatusOK {
				t.Fatalf("expected 200, got %d body %s", response.Code, response.Body.String())
			}
			var body struct {
				Client      string                 `json:"client"`
				Placeholder bool                   `json:"placeholder"`
				GatewayURL  string                 `json:"gatewayUrl"`
				Config      map[string]interface{} `json:"config"`
			}
			if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
				t.Fatal(err)
			}
			if body.Client != client || body.GatewayURL == "" || len(body.Config) == 0 {
				t.Fatalf("invalid config body: %#v", body)
			}
			if client == "opencode" && body.Placeholder {
				t.Fatalf("opencode config must be non-placeholder: %#v", body)
			}
			if client != "generic" && client != "opencode" && !body.Placeholder {
				t.Fatalf("%s should remain placeholder until exact client format is confirmed", client)
			}
		})
	}
}

func postClientConfig(t *testing.T, handler http.Handler, client string) *httptest.ResponseRecorder {
	t.Helper()
	body, err := json.Marshal(map[string]interface{}{"client": client, "serverId": db.K8sReadonlyID})
	if err != nil {
		t.Fatal(err)
	}
	recorder := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/client-config/generate", bytes.NewReader(body))
	req.Header.Set("content-type", "application/json")
	handler.ServeHTTP(recorder, req)
	return recorder
}
