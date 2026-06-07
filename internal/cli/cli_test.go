package cli

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestCLIVersionAndHealth(t *testing.T) {
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("content-type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	}))
	defer api.Close()
	out := &bytes.Buffer{}
	code := Run(Options{Args: []string{"--api-url", api.URL, "--output", "json", "health"}, Writer: out, ErrWriter: &bytes.Buffer{}})
	if code != 0 || !strings.Contains(out.String(), "ok") {
		t.Fatalf("health failed code=%d out=%s", code, out.String())
	}

	out.Reset()
	code = Run(Options{Args: []string{"version"}, Writer: out, ErrWriter: &bytes.Buffer{}})
	if code != 0 || !strings.Contains(out.String(), "mcphubctl") {
		t.Fatalf("version failed code=%d out=%s", code, out.String())
	}
}

func TestCLIUsesStoredBearerToken(t *testing.T) {
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("authorization"); got != "Bearer stored-token" {
			t.Fatalf("expected bearer token, got %q", got)
		}
		w.Header().Set("content-type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	}))
	defer api.Close()
	configPath := filepath.Join(t.TempDir(), "config.yaml")
	if err := os.WriteFile(configPath, []byte("token: stored-token\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	out := &bytes.Buffer{}
	code := Run(Options{Args: []string{"--api-url", api.URL, "health"}, ConfigPath: configPath, Writer: out, ErrWriter: &bytes.Buffer{}})
	if code != 0 {
		t.Fatalf("health failed code=%d out=%s", code, out.String())
	}
}

func TestCLILoginStoresTokenWithoutPrintingIt(t *testing.T) {
	configPath := filepath.Join(t.TempDir(), "config.yaml")
	out := &bytes.Buffer{}
	code := Run(Options{Args: []string{"--api-url", "http://api.local", "login", "--token", "secret-token"}, ConfigPath: configPath, Writer: out, ErrWriter: &bytes.Buffer{}})
	if code != 0 {
		t.Fatalf("login failed code=%d", code)
	}
	if strings.Contains(out.String(), "secret-token") {
		t.Fatalf("login output leaked token: %s", out.String())
	}
	data, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(data), "token: secret-token") {
		t.Fatalf("config did not store token: %s", string(data))
	}
}

func TestCLIClientTestCallsGateway(t *testing.T) {
	gateway := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/mcp/k8s-readonly" {
			t.Fatalf("unexpected gateway path %s", r.URL.Path)
		}
		if got := r.Header.Get("authorization"); got != "Bearer dev-admin-token" {
			t.Fatalf("expected bearer token, got %q", got)
		}
		w.Header().Set("content-type", "application/json")
		_, _ = w.Write([]byte(`{"jsonrpc":"2.0","id":1,"result":{"tools":[{"name":"list_namespaces"}]}}`))
	}))
	defer gateway.Close()
	out := &bytes.Buffer{}
	code := Run(Options{Args: []string{"--output", "json", "client", "test", "--gateway-url", gateway.URL, "--server", "k8s-readonly"}, Token: "dev-admin-token", Writer: out, ErrWriter: &bytes.Buffer{}})
	if code != 0 || !strings.Contains(out.String(), `"status": "ok"`) || !strings.Contains(out.String(), `"toolCount": 1`) {
		t.Fatalf("client test failed code=%d out=%s", code, out.String())
	}
}

func TestCLIAuditExportBuildsComplianceQuery(t *testing.T) {
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/audit-events/export" {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
		if r.URL.Query().Get("from") != "2026-06-07T00:00:00Z" || r.URL.Query().Get("to") != "2026-06-08T00:00:00Z" || r.URL.Query().Get("signed") != "true" {
			t.Fatalf("unexpected query %s", r.URL.RawQuery)
		}
		if got := r.Header.Get("authorization"); got != "Bearer export-token" {
			t.Fatalf("expected bearer token, got %q", got)
		}
		w.Header().Set("content-type", "application/json")
		_, _ = w.Write([]byte(`{"exportId":"exp","redacted":true,"signed":true}`))
	}))
	defer api.Close()
	out := &bytes.Buffer{}
	code := Run(Options{Args: []string{"--api-url", api.URL, "--output", "json", "audit", "export", "--from", "2026-06-07T00:00:00Z", "--to", "2026-06-08T00:00:00Z", "--signed"}, Token: "export-token", Writer: out, ErrWriter: &bytes.Buffer{}})
	if code != 0 || !strings.Contains(out.String(), "exportId") {
		t.Fatalf("audit export failed code=%d out=%s", code, out.String())
	}
}
