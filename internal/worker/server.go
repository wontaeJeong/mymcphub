package worker

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/mcp-hub/mcp-hub/internal/auth"
	"github.com/mcp-hub/mcp-hub/internal/config"
	"github.com/mcp-hub/mcp-hub/internal/db"
	"github.com/mcp-hub/mcp-hub/internal/httpx"
	"github.com/mcp-hub/mcp-hub/internal/jobs"
	"github.com/mcp-hub/mcp-hub/internal/logger"
	"github.com/mcp-hub/mcp-hub/internal/telemetry"
)

type Server struct {
	registry *jobs.Registry
	log      logger.Logger
	cfg      config.Config
	last     []jobs.Result
}

func NewServer(store *db.Store, cfg config.Config) *Server {
	return &Server{registry: jobs.NewRegistry(store), cfg: cfg, log: logger.New("worker")}
}

func (s *Server) Handler() http.Handler {
	return telemetry.Handler("worker", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		finish := s.registry.Store().BeginRequest(r.Method == http.MethodPost)
		defer finish()
		s.log.InfoContext(r.Context(), "worker.request", map[string]interface{}{"method": r.Method, "path": r.URL.Path})
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/healthz":
			httpx.WriteJSON(w, 200, map[string]string{"service": "worker", "status": "ok"})
		case r.Method == http.MethodGet && r.URL.Path == "/readyz":
			httpx.WriteJSON(w, 200, map[string]interface{}{"service": "worker", "status": "ready", "supportedJobs": jobs.DefaultKinds})
		case r.Method == http.MethodGet && r.URL.Path == "/metrics":
			httpx.WriteText(w, 200, "text/plain; version=0.0.4", telemetry.MetricsText("worker"))
		case r.Method == http.MethodPost && r.URL.Path == "/jobs/run":
			if !s.authorizeJobRun(w, r) {
				return
			}
			var input []jobs.Job
			decoder := json.NewDecoder(r.Body)
			if err := decoder.Decode(&input); err != nil {
				httpx.WriteError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Request body must be a JSON job array.", auth.TraceID(r), map[string]interface{}{"error": err.Error()})
				return
			}
			if err := rejectTrailingJSON(decoder); err != nil {
				httpx.WriteError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Request body must contain exactly one JSON job array.", auth.TraceID(r), map[string]interface{}{"error": err.Error()})
				return
			}
			if input == nil {
				httpx.WriteError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Request body must be a JSON job array.", auth.TraceID(r), nil)
				return
			}
			s.last = s.registry.RunOnce(telemetry.ContextWithNewCorrelation(r.Context()), input)
			telemetry.SetWorkerLastRun("worker", len(s.last))
			httpx.WriteJSON(w, 202, map[string]interface{}{"results": s.last})
		default:
			httpx.WriteJSON(w, 404, map[string]string{"error": "not_found"})
		}
	}))
}

func rejectTrailingJSON(decoder *json.Decoder) error {
	var trailing struct{}
	err := decoder.Decode(&trailing)
	if err == io.EOF {
		return nil
	}
	if err == nil {
		return fmt.Errorf("unexpected trailing JSON value")
	}
	return err
}

func (s *Server) authorizeJobRun(w http.ResponseWriter, r *http.Request) bool {
	if token := strings.TrimSpace(s.cfg.WorkerJobToken); token != "" {
		actual := bearerToken(r)
		if actual != "" && len(actual) == len(token) && subtle.ConstantTimeCompare([]byte(actual), []byte(token)) == 1 {
			return true
		}
	}
	if principal, ok := auth.PrincipalFromBearer(r); ok && auth.RequirePlatformAdmin(principal) {
		return true
	}
	httpx.WriteError(w, http.StatusForbidden, "AUTHORIZATION_DENIED", "Worker job trigger requires a platform-admin bearer token or MCP_WORKER_JOB_TOKEN.", auth.TraceID(r), nil)
	return false
}

func bearerToken(r *http.Request) string {
	value := r.Header.Get("authorization")
	if !strings.HasPrefix(value, "Bearer ") {
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(value, "Bearer "))
}

func (s *Server) RunLoop(ctx context.Context) {
	interval := s.cfg.RuntimeReconcileInterval
	if interval <= 0 && s.cfg.WorkerIntervalSeconds > 0 {
		interval = time.Duration(s.cfg.WorkerIntervalSeconds) * time.Second
	}
	if interval <= 0 {
		interval = time.Minute
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	s.runOnce(ctx)
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.runOnce(ctx)
		}
	}
}

func (s *Server) runOnce(ctx context.Context) {
	finish := s.registry.Store().BeginRequest(true)
	defer finish()
	s.last = s.registry.RunOnce(telemetry.ContextWithNewCorrelation(ctx), nil)
	telemetry.SetWorkerLastRun("worker", len(s.last))
}

func ListenAndServe(store *db.Store, cfg config.Config) error {
	shutdown, err := telemetry.Init(context.Background(), "worker")
	if err != nil {
		return err
	}
	defer shutdown(context.Background())
	server := NewServer(store, cfg)
	go server.RunLoop(context.Background())
	address := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	return http.ListenAndServe(address, server.Handler())
}
