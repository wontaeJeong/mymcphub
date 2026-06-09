package controlplane

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/mcp-hub/mcp-hub/internal/auth"
	"github.com/mcp-hub/mcp-hub/internal/config"
	"github.com/mcp-hub/mcp-hub/internal/db"
	"github.com/mcp-hub/mcp-hub/internal/httpx"
	"github.com/mcp-hub/mcp-hub/internal/mcp"
)

type Server struct {
	repo db.Repository
	cfg  config.Config
	sync mcp.Client
}

func New(repo db.Repository, cfg config.Config) *Server {
	return &Server{repo: repo, cfg: cfg, sync: mcp.Client{Timeout: cfg.SyncTimeout}}
}
func ListenAndServe(repo db.Repository, cfg config.Config) error {
	return http.ListenAndServe(cfg.Addr(), New(repo, cfg).Handler())
}
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", s.healthz)
	mux.HandleFunc("/readyz", s.readyz)
	mux.HandleFunc("/api/catalog/summary", s.read(s.summary))
	mux.HandleFunc("/api/servers", s.read(s.servers))
	mux.HandleFunc("/api/servers/", s.read(s.serverSub))
	mux.HandleFunc("/api/admin/servers", s.admin(s.adminServers))
	mux.HandleFunc("/api/admin/servers/", s.admin(s.adminServerSub))
	mux.HandleFunc("/api/admin/audit-events", s.admin(s.audit))
	return mux
}
func (s *Server) healthz(w http.ResponseWriter, r *http.Request) {
	httpx.WriteJSON(w, 200, map[string]string{"status": "ok"})
}
func (s *Server) readyz(w http.ResponseWriter, r *http.Request) {
	if err := s.repo.Ready(r.Context()); err != nil {
		httpx.WriteError(w, 503, "NOT_READY", err.Error(), auth.TraceID(r), nil)
		return
	}
	httpx.WriteJSON(w, 200, map[string]string{"status": "ready"})
}
func (s *Server) read(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if _, ok := auth.Authenticate(r, s.cfg, false); !ok && s.cfg.AuthMode != "dev" {
			httpx.WriteError(w, 401, "AUTH_REQUIRED", "read authentication is required", auth.TraceID(r), nil)
			return
		}
		next(w, r)
	}
}
func (s *Server) admin(next func(http.ResponseWriter, *http.Request, auth.Principal)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		p, ok := auth.Authenticate(r, s.cfg, true)
		if !ok || !p.Admin {
			httpx.WriteError(w, 401, "ADMIN_AUTH_REQUIRED", "admin bearer token is required", auth.TraceID(r), nil)
			return
		}
		next(w, r, p)
	}
}
func (s *Server) summary(w http.ResponseWriter, r *http.Request) {
	v, err := s.repo.Summary(r.Context())
	write(w, r, v, err)
}
func (s *Server) servers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		method(w, r)
		return
	}
	f := map[string]string{}
	for _, k := range []string{"transport", "status", "environment", "ownerTeam", "q", "tag", "livenessStatus"} {
		f[k] = r.URL.Query().Get(k)
	}
	items, err := s.repo.ListServers(r.Context(), f)
	write(w, r, db.ListResponse[db.Server]{Items: items}, err)
}
func (s *Server) serverSub(w http.ResponseWriter, r *http.Request) {
	parts := parts(r.URL.Path, "/api/servers/")
	if len(parts) == 0 {
		notFound(w, r)
		return
	}
	id := parts[0]
	if len(parts) == 1 {
		if r.Method != http.MethodGet {
			method(w, r)
			return
		}
		v, err := s.repo.GetServer(r.Context(), id)
		write(w, r, v, err)
		return
	}
	switch parts[1] {
	case "capability-snapshot":
		if r.Method != http.MethodGet {
			method(w, r)
			return
		}
		v, err := s.repo.LatestSnapshot(r.Context(), id)
		write(w, r, v, err)
	case "health":
		if r.Method != http.MethodGet {
			method(w, r)
			return
		}
		v, err := s.repo.ListHealth(r.Context(), id)
		write(w, r, db.ListResponse[db.HealthCheck]{Items: v}, err)
	default:
		notFound(w, r)
	}
}
func (s *Server) adminServers(w http.ResponseWriter, r *http.Request, p auth.Principal) {
	switch r.Method {
	case http.MethodPost:
		var in db.Server
		if err := httpx.DecodeJSON(r, &in); err != nil {
			bad(w, r, err)
			return
		}
		if err := validate(in); err != nil {
			bad(w, r, err)
			return
		}
		v, err := s.repo.CreateServer(r.Context(), in, p.Actor)
		writeStatus(w, r, 201, v, err)
	default:
		method(w, r)
	}
}
func (s *Server) adminServerSub(w http.ResponseWriter, r *http.Request, p auth.Principal) {
	parts := parts(r.URL.Path, "/api/admin/servers/")
	if len(parts) == 0 {
		notFound(w, r)
		return
	}
	id := parts[0]
	if len(parts) == 1 {
		switch r.Method {
		case http.MethodPatch:
			var in db.ServerPatch
			if err := httpx.DecodeJSON(r, &in); err != nil {
				bad(w, r, err)
				return
			}
			v, err := s.repo.PatchServer(r.Context(), id, in, p.Actor)
			write(w, r, v, err)
		case http.MethodDelete:
			err := s.repo.DeleteServer(r.Context(), id, p.Actor)
			write(w, r, map[string]string{"status": "deleted"}, err)
		default:
			method(w, r)
		}
		return
	}
	switch parts[1] {
	case "sync":
		if r.Method != http.MethodPost {
			method(w, r)
			return
		}
		s.syncServer(w, r, id, p.Actor)
	case "snapshots":
		if r.Method != http.MethodPost {
			method(w, r)
			return
		}
		var snap db.CapabilitySnapshot
		if err := httpx.DecodeJSON(r, &snap); err != nil {
			bad(w, r, err)
			return
		}
		v, err := s.repo.SaveSnapshot(r.Context(), id, snap, p.Actor)
		writeStatus(w, r, 201, v, err)
	default:
		notFound(w, r)
	}
}
func (s *Server) syncServer(w http.ResponseWriter, r *http.Request, id, actor string) {
	srv, err := s.repo.GetServer(r.Context(), id)
	if err != nil {
		write(w, r, nil, err)
		return
	}
	if srv.Transport == db.TransportStdio && !s.cfg.EnableServerStdioExec {
		httpx.WriteError(w, 403, "SERVER_STDIO_DISABLED", "server-side stdio execution is disabled; use mcphubctl server sync-stdio", auth.TraceID(r), nil)
		return
	}
	var snap db.CapabilitySnapshot
	if srv.Transport == db.TransportStreamableHTTP {
		snap, err = s.sync.SyncStreamableHTTP(r.Context(), srv.EndpointURL)
	} else {
		snap, err = s.sync.SyncStdio(r.Context(), srv.StdioCommand, srv.StdioArgs, nil)
	}
	if err != nil {
		_ = s.repo.MarkSyncFailed(context.Background(), srv.ID, err.Error(), actor)
		write(w, r, nil, err)
		return
	}
	v, err := s.repo.SaveSnapshot(r.Context(), srv.ID, snap, actor)
	write(w, r, v, err)
}
func (s *Server) audit(w http.ResponseWriter, r *http.Request, p auth.Principal) {
	if r.Method != http.MethodGet {
		method(w, r)
		return
	}
	v, err := s.repo.ListAudit(r.Context(), r.URL.Query().Get("server"))
	write(w, r, db.ListResponse[db.AuditEvent]{Items: v}, err)
}
func validate(s db.Server) error {
	if s.Name == "" {
		return errors.New("name is required")
	}
	if s.Transport != db.TransportStreamableHTTP && s.Transport != db.TransportStdio {
		return errors.New("transport must be streamable_http or stdio")
	}
	if s.Transport == db.TransportStreamableHTTP && s.EndpointURL == "" {
		return errors.New("endpointUrl is required for streamable_http")
	}
	if s.Transport == db.TransportStdio && s.StdioCommand == "" {
		return errors.New("stdioCommand is required for stdio")
	}
	if s.HostingType == "" || s.OwnerTeam == "" || s.Environment == "" {
		return errors.New("hostingType, ownerTeam, and environment are required")
	}
	return nil
}
func write(w http.ResponseWriter, r *http.Request, v interface{}, err error) {
	writeStatus(w, r, 200, v, err)
}
func writeStatus(w http.ResponseWriter, r *http.Request, status int, v interface{}, err error) {
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			httpx.WriteError(w, 404, "NOT_FOUND", "resource not found", auth.TraceID(r), nil)
			return
		}
		httpx.WriteError(w, 500, "INTERNAL_ERROR", err.Error(), auth.TraceID(r), nil)
		return
	}
	httpx.WriteJSON(w, status, v)
}
func bad(w http.ResponseWriter, r *http.Request, err error) {
	httpx.WriteError(w, 400, "VALIDATION_ERROR", err.Error(), auth.TraceID(r), nil)
}
func method(w http.ResponseWriter, r *http.Request) {
	httpx.WriteError(w, 405, "METHOD_NOT_ALLOWED", "method not allowed", auth.TraceID(r), nil)
}
func notFound(w http.ResponseWriter, r *http.Request) {
	httpx.WriteError(w, 404, "NOT_FOUND", "route not found", auth.TraceID(r), nil)
}
func parts(path, prefix string) []string {
	rest := strings.Trim(strings.TrimPrefix(path, prefix), "/")
	if rest == "" {
		return nil
	}
	return strings.Split(rest, "/")
}
func OpenAPIDocument() map[string]interface{} {
	paths := map[string]interface{}{}
	for _, p := range []string{"/healthz", "/readyz", "/api/catalog/summary", "/api/servers", "/api/servers/{serverId}", "/api/servers/{serverId}/capability-snapshot", "/api/servers/{serverId}/health", "/api/admin/servers", "/api/admin/servers/{serverId}", "/api/admin/servers/{serverId}/sync", "/api/admin/servers/{serverId}/snapshots", "/api/admin/audit-events"} {
		paths[p] = map[string]interface{}{}
	}
	return map[string]interface{}{"openapi": "3.1.0", "info": map[string]string{"title": "MCP Hub MVP API", "version": "0.1.0"}, "paths": paths}
}
func WriteOpenAPI(w http.ResponseWriter) { _ = json.NewEncoder(w).Encode(OpenAPIDocument()) }
func init()                              { log.SetFlags(log.LstdFlags | log.LUTC) }
