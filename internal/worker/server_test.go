package worker

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mcp-hub/mcp-hub/internal/auth"
	"github.com/mcp-hub/mcp-hub/internal/config"
	"github.com/mcp-hub/mcp-hub/internal/db"
)

func TestWorkerJobRunRequiresAuthorization(t *testing.T) {
	server := NewServer(db.NewSeedStore(), config.Config{})
	recorder := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/jobs/run", bytes.NewReader([]byte(`[]`)))
	server.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d %s", recorder.Code, recorder.Body.String())
	}
}

func TestWorkerJobRunAcceptsServiceToken(t *testing.T) {
	server := NewServer(db.NewSeedStore(), config.Config{WorkerJobToken: "service-token"})
	recorder := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/jobs/run", bytes.NewReader([]byte(`[{
		"kind":"health-check",
		"targetServerId":"00000000-0000-4000-8000-000000000102"
	}]`)))
	req.Header.Set("authorization", "Bearer service-token")
	server.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusAccepted {
		t.Fatalf("expected 202, got %d %s", recorder.Code, recorder.Body.String())
	}
}

func TestWorkerJobRunRejectsMalformedJSON(t *testing.T) {
	server := NewServer(db.NewSeedStore(), config.Config{WorkerJobToken: "service-token"})
	recorder := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/jobs/run", bytes.NewReader([]byte(`{`)))
	req.Header.Set("authorization", "Bearer service-token")
	server.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d %s", recorder.Code, recorder.Body.String())
	}
}

func TestWorkerJobRunRejectsTrailingJSON(t *testing.T) {
	server := NewServer(db.NewSeedStore(), config.Config{WorkerJobToken: "service-token"})
	recorder := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/jobs/run", bytes.NewReader([]byte(`[] {}`)))
	req.Header.Set("authorization", "Bearer service-token")
	server.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d %s", recorder.Code, recorder.Body.String())
	}
}

func TestWorkerJobRunRejectsNullJSON(t *testing.T) {
	server := NewServer(db.NewSeedStore(), config.Config{WorkerJobToken: "service-token"})
	recorder := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/jobs/run", bytes.NewReader([]byte(`null`)))
	req.Header.Set("authorization", "Bearer service-token")
	server.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d %s", recorder.Code, recorder.Body.String())
	}
}

func TestWorkerJobRunAcceptsMockAdminBearer(t *testing.T) {
	server := NewServer(db.NewSeedStore(), config.Config{})
	recorder := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/jobs/run", bytes.NewReader([]byte(`[{
		"kind":"health-check",
		"targetServerId":"00000000-0000-4000-8000-000000000102"
	}]`)))
	req.Header.Set("authorization", "Bearer "+auth.AdminToken)
	server.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusAccepted {
		t.Fatalf("expected 202, got %d %s", recorder.Code, recorder.Body.String())
	}
}
