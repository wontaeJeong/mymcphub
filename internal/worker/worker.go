package worker

import (
	"log"
	"net/http"
	"time"

	"github.com/mcp-hub/mcp-hub/internal/config"
	"github.com/mcp-hub/mcp-hub/internal/db"
	"github.com/mcp-hub/mcp-hub/internal/httpx"
	"github.com/mcp-hub/mcp-hub/internal/mcp"
)

type Server struct {
	repo   db.Repository
	cfg    config.Config
	client mcp.Client
}

func ListenAndServe(repo db.Repository, cfg config.Config) error {
	s := &Server{repo: repo, cfg: cfg, client: mcp.Client{Timeout: cfg.SyncTimeout}}
	go s.loop()
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		httpx.WriteJSON(w, 200, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
		httpx.WriteJSON(w, 200, map[string]string{"status": "ready"})
	})
	mux.HandleFunc("/jobs/run", s.run)
	return http.ListenAndServe(cfg.Addr(), mux)
}
func (s *Server) loop() {
	t := time.NewTicker(s.cfg.WorkerInterval)
	defer t.Stop()
	for range t.C {
		s.syncAll()
	}
}
func (s *Server) run(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		httpx.WriteError(w, 405, "METHOD_NOT_ALLOWED", "method not allowed", "", nil)
		return
	}
	s.syncAll()
	httpx.WriteJSON(w, 200, map[string]string{"status": "ok"})
}
func (s *Server) syncAll() {
	servers, err := s.repo.ListServers(nil, map[string]string{"transport": "streamable_http", "status": "active"})
	if err != nil {
		log.Print(err)
		return
	}
	for _, srv := range servers {
		status, lat, msg := s.client.HealthStreamableHTTP(nil, srv.EndpointURL)
		_ = s.repo.AddHealth(nil, db.HealthCheck{ServerID: srv.ID, Status: status, LatencyMS: lat, ErrorMessage: msg})
		snap, err := s.client.SyncStreamableHTTP(nil, srv.EndpointURL)
		if err != nil {
			_ = s.repo.MarkSyncFailed(nil, srv.ID, err.Error(), "worker")
			continue
		}
		_, _ = s.repo.SaveSnapshot(nil, srv.ID, snap, "worker")
	}
}
