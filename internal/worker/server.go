package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/mcp-hub/mcp-hub/internal/config"
	"github.com/mcp-hub/mcp-hub/internal/db"
	"github.com/mcp-hub/mcp-hub/internal/httpx"
	"github.com/mcp-hub/mcp-hub/internal/jobs"
	"github.com/mcp-hub/mcp-hub/internal/logger"
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
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s.registry.Store().Refresh()
		if r.Method == http.MethodPost {
			defer s.registry.Store().Save()
		}
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/healthz":
			httpx.WriteJSON(w, 200, map[string]string{"service": "worker", "status": "ok"})
		case r.Method == http.MethodGet && r.URL.Path == "/readyz":
			httpx.WriteJSON(w, 200, map[string]interface{}{"service": "worker", "status": "ready", "supportedJobs": jobs.DefaultKinds})
		case r.Method == http.MethodGet && r.URL.Path == "/metrics":
			httpx.WriteText(w, 200, "text/plain; version=0.0.4", fmt.Sprintf("mcp_worker_last_run_jobs_total %d\n", len(s.last)))
		case r.Method == http.MethodPost && r.URL.Path == "/jobs/run":
			var input []jobs.Job
			_ = json.NewDecoder(r.Body).Decode(&input)
			s.last = s.registry.RunOnce(r.Context(), input)
			httpx.WriteJSON(w, 202, map[string]interface{}{"results": s.last})
		default:
			httpx.WriteJSON(w, 404, map[string]string{"error": "not_found"})
		}
	})
}

func (s *Server) RunLoop(ctx context.Context) {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	s.registry.Store().Refresh()
	s.last = s.registry.RunOnce(ctx, nil)
	s.registry.Store().Save()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.registry.Store().Refresh()
			s.last = s.registry.RunOnce(ctx, nil)
			s.registry.Store().Save()
		}
	}
}

func ListenAndServe(store *db.Store, cfg config.Config) error {
	server := NewServer(store, cfg)
	go server.RunLoop(context.Background())
	address := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	return http.ListenAndServe(address, server.Handler())
}
