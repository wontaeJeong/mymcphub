package controlplane

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/mcp-hub/mcp-hub/internal/auth"
	"github.com/mcp-hub/mcp-hub/internal/config"
	"github.com/mcp-hub/mcp-hub/internal/db"
	"github.com/mcp-hub/mcp-hub/internal/httpx"
	"github.com/mcp-hub/mcp-hub/internal/logger"
	"github.com/mcp-hub/mcp-hub/internal/policy"
	"github.com/mcp-hub/mcp-hub/internal/ratelimit"
	mcruntime "github.com/mcp-hub/mcp-hub/internal/runtime"
	"github.com/mcp-hub/mcp-hub/internal/telemetry"
)

type Server struct {
	store   *db.Store
	log     logger.Logger
	cfg     config.Config
	limiter *ratelimit.Limiter
}

func NewServer(store *db.Store, cfg config.Config) *Server {
	if store == nil {
		store = db.NewSeedStore()
	}
	return &Server{store: store, cfg: cfg, log: logger.New("api"), limiter: ratelimit.NewStore(cfg.GatewayRateLimit, time.Duration(cfg.RateLimitWindow())*time.Second, store)}
}
func (s *Server) Store() *db.Store { return s.store }

func (s *Server) Handler() http.Handler { return telemetry.Handler("api", http.HandlerFunc(s.handle)) }

func (s *Server) handle(w http.ResponseWriter, r *http.Request) {
	finish := s.store.BeginRequest(r.Method != http.MethodGet)
	defer finish()
	traceID := auth.TraceID(r)
	w.Header().Set("x-trace-id", traceID)
	if err := s.store.Refresh(); err != nil {
		httpx.WriteError(w, 503, "STORE_REFRESH_FAILED", "Runtime store could not be refreshed.", traceID, nil)
		return
	}
	if r.Method != http.MethodGet {
		defer func() {
			if err := s.store.Save(); err != nil {
				s.log.Error("api.store.save.failed", map[string]interface{}{"traceId": traceID, "error": err.Error()})
			}
		}()
	}
	principal := auth.ContextFromHeaders(r)
	s.log.Info("api.request", map[string]interface{}{"traceId": traceID, "method": r.Method, "path": r.URL.Path})
	s.log.InfoContext(r.Context(), "api.request", map[string]interface{}{"traceId": traceID, "method": r.Method, "path": r.URL.Path})
	if s.rateLimitAPI(w, r, principal, traceID) {
		return
	}

	switch {
	case r.Method == http.MethodGet && r.URL.Path == "/healthz":
		httpx.WriteJSON(w, 200, map[string]interface{}{"service": "api", "status": "ok"})
	case r.Method == http.MethodGet && r.URL.Path == "/readyz":
		httpx.WriteJSON(w, 200, map[string]interface{}{"service": "api", "status": "ready", "dependencies": map[string]string{"store": "ready"}})
	case r.Method == http.MethodGet && r.URL.Path == "/metrics":
		httpx.WriteText(w, 200, "text/plain; version=0.0.4", telemetry.MetricsText("api"))
	case r.Method == http.MethodGet && (r.URL.Path == "/openapi.json" || r.URL.Path == "/api/openapi.json"):
		httpx.WriteJSON(w, 200, OpenAPIDocument())
	case r.Method == http.MethodGet && r.URL.Path == "/api/me":
		httpx.WriteJSON(w, 200, map[string]interface{}{"auth": principal})
	case strings.HasPrefix(r.URL.Path, "/api/servers"):
		s.handleServers(w, r, principal, traceID)
	case strings.HasPrefix(r.URL.Path, "/api/grants"):
		s.handleGrants(w, r, principal, traceID)
	case strings.HasPrefix(r.URL.Path, "/api/approvals"):
		s.handleApprovals(w, r, principal, traceID)
	case strings.HasPrefix(r.URL.Path, "/api/audit-events"):
		s.handleAudit(w, r, principal, traceID)
	case strings.HasPrefix(r.URL.Path, "/api/secret-bindings"):
		s.handleSecretBindings(w, r, principal, traceID)
	case strings.HasPrefix(r.URL.Path, "/api/tenancy"):
		s.handleTenancy(w, r, principal, traceID)
	case r.Method == http.MethodGet && r.URL.Path == "/api/tool-call-events":
		httpx.WriteJSON(w, 200, s.store.ListToolCallEvents())
	case r.Method == http.MethodGet && r.URL.Path == "/api/server-health":
		httpx.WriteJSON(w, 200, s.store.ListHealth())
	case strings.HasPrefix(r.URL.Path, "/api/runtime"):
		s.handleRuntime(w, r, principal, traceID)
	case strings.HasPrefix(r.URL.Path, "/api/analytics"):
		s.handleAnalytics(w, r, principal, traceID)
	case r.Method == http.MethodPost && r.URL.Path == "/api/client-config/generate":
		s.handleClientConfig(w, r, traceID)
	case strings.HasPrefix(r.URL.Path, "/api/policy"):
		s.handlePolicy(w, r, principal, traceID)
	case strings.HasPrefix(r.URL.Path, "/api/admin"):
		s.handleAdmin(w, r, principal, traceID)
	default:
		httpx.WriteError(w, 404, "NOT_FOUND", "Route not found", traceID, nil)
	}
}

func (s *Server) handleServers(w http.ResponseWriter, r *http.Request, principal db.AuthContext, traceID string) {
	parts := pathParts(r.URL.Path, "/api/servers")
	if len(parts) == 0 {
		if r.Method == http.MethodGet {
			httpx.WriteJSON(w, 200, s.store.ListServersWithOptions(listOptionsFromRequest(r, []string{"environment", "risk_level", "owner_team_id", "transport", "enabled", "published", "q"})))
			return
		}
		if r.Method == http.MethodPost {
			if !auth.RequirePlatformAdmin(principal) {
				httpx.WriteError(w, 403, "AUTHORIZATION_DENIED", "Platform admin role is required for this action.", traceID, nil)
				return
			}
			s.createServer(w, r, principal, traceID)
			return
		}
	}
	serverID := parts[0]
	if len(parts) == 1 {
		switch r.Method {
		case http.MethodGet:
			value, err := s.store.GetServer(serverID)
			respond(w, traceID, value, err)
		case http.MethodDelete:
			if !requireAdmin(w, principal, traceID) {
				return
			}
			err := s.store.DeleteServer(serverID, principal, traceID)
			respond(w, traceID, map[string]interface{}{"deleted": true, "serverId": serverID}, err)
		case http.MethodPatch:
			if !requireAdmin(w, principal, traceID) {
				return
			}
			var patch map[string]interface{}
			if decode(w, r, traceID, &patch) {
				value, err := s.store.PatchServer(serverID, patch, principal, traceID)
				respond(w, traceID, value, err)
			}
		default:
			httpx.WriteError(w, 405, "METHOD_NOT_ALLOWED", "Method not allowed", traceID, nil)
		}
		return
	}
	switch parts[1] {
	case "versions":
		s.handleVersions(w, r, principal, traceID, serverID, parts[2:])
	case "rollout":
		if r.Method == http.MethodGet {
			value, err := s.store.RolloutStatus(serverID)
			respond(w, traceID, value, err)
			return
		}
		httpx.WriteError(w, 405, "METHOD_NOT_ALLOWED", "Method not allowed", traceID, nil)
	case "schema-diff":
		if len(parts) == 2 && r.Method == http.MethodGet {
			value, err := s.store.SchemaDiff(serverID)
			respond(w, traceID, value, err)
			return
		}
		if len(parts) == 3 && parts[2] == "history" && r.Method == http.MethodGet {
			value, err := s.store.ListSchemaDiffs(serverID, listOptionsFromRequest(r, nil))
			respond(w, traceID, value, err)
			return
		}
		httpx.WriteError(w, 405, "METHOD_NOT_ALLOWED", "Method not allowed", traceID, nil)
	case "schema-snapshots":
		if len(parts) == 2 && r.Method == http.MethodGet {
			value, err := s.store.ListSchemaSnapshots(serverID)
			respond(w, traceID, value, err)
			return
		}
		if len(parts) == 2 && r.Method == http.MethodPost {
			if !requireAdmin(w, principal, traceID) {
				return
			}
			value, err := s.store.RecordCurrentSchemaSnapshot(serverID, "api")
			respondStatus(w, traceID, 201, value, err)
			return
		}
		httpx.WriteError(w, 405, "METHOD_NOT_ALLOWED", "Method not allowed", traceID, nil)
	case "runtime":
		if r.Method == http.MethodGet {
			if !requireAdmin(w, principal, traceID) {
				return
			}
			value, err := s.store.GetRuntimeStatus(serverID)
			respond(w, traceID, value, err)
			return
		}
		httpx.WriteError(w, 405, "METHOD_NOT_ALLOWED", "Method not allowed", traceID, nil)
	case "tools":
		s.handleTools(w, r, principal, traceID, serverID, parts[2:])
	case "enable", "disable", "publish", "unpublish", "quarantine":
		if r.Method != http.MethodPost {
			httpx.WriteError(w, 405, "METHOD_NOT_ALLOWED", "Method not allowed", traceID, nil)
			return
		}
		if !requireAdmin(w, principal, traceID) {
			return
		}
		value, err := s.store.SetServerState(serverID, parts[1], principal, traceID)
		respond(w, traceID, value, err)
	default:
		httpx.WriteError(w, 404, "NOT_FOUND", "Server route not found", traceID, nil)
	}
}

func (s *Server) createServer(w http.ResponseWriter, r *http.Request, principal db.AuthContext, traceID string) {
	var input struct {
		db.MCPServer
		Tools []db.MCPTool `json:"tools"`
	}
	if !decode(w, r, traceID, &input) {
		return
	}
	server, err := s.store.CreateServer(input.MCPServer, input.Tools, principal, traceID, input)
	respondStatus(w, traceID, 201, server, err)
}

func (s *Server) handleVersions(w http.ResponseWriter, r *http.Request, principal db.AuthContext, traceID, serverID string, parts []string) {
	if len(parts) == 0 {
		if r.Method == http.MethodGet {
			if !requireAdmin(w, principal, traceID) {
				return
			}
			value, err := s.store.ListVersions(serverID)
			respond(w, traceID, value, err)
			return
		}
		if r.Method == http.MethodPost {
			if !requireAdmin(w, principal, traceID) {
				return
			}
			var input db.MCPServerVersion
			if decode(w, r, traceID, &input) {
				if len(input.ManifestJSON) > 0 {
					if _, err := mcruntime.ManifestFromMap(input.ManifestJSON); err != nil {
						httpx.WriteError(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error(), traceID, nil)
						return
					}
				}
				value, err := s.store.CreateVersion(serverID, input, principal, traceID, input)
				respondStatus(w, traceID, 201, value, err)
			}
			return
		}
	}
	if len(parts) == 2 && r.Method == http.MethodPost && (parts[1] == "activate" || parts[1] == "rollback") {
		if !requireAdmin(w, principal, traceID) {
			return
		}
		value, err := s.store.ActivateVersion(serverID, parts[0], parts[1] == "rollback", principal, traceID)
		respond(w, traceID, value, err)
		return
	}
	httpx.WriteError(w, 404, "NOT_FOUND", "Version route not found", traceID, nil)
}

func (s *Server) handleTools(w http.ResponseWriter, r *http.Request, principal db.AuthContext, traceID, serverID string, parts []string) {
	if len(parts) == 0 && r.Method == http.MethodGet {
		value, err := s.store.ListTools(serverID)
		respond(w, traceID, value, err)
		return
	}
	if len(parts) >= 1 {
		toolID := parts[0]
		if len(parts) == 1 && r.Method == http.MethodPatch {
			if !requireAdmin(w, principal, traceID) {
				return
			}
			var patch map[string]interface{}
			if decode(w, r, traceID, &patch) {
				value, err := s.store.PatchTool(serverID, toolID, patch, principal, traceID)
				respond(w, traceID, value, err)
			}
			return
		}
		if len(parts) == 2 && r.Method == http.MethodPost && (parts[1] == "enable" || parts[1] == "disable") {
			if !requireAdmin(w, principal, traceID) {
				return
			}
			value, err := s.store.SetToolEnabled(serverID, toolID, parts[1] == "enable", principal, traceID)
			respond(w, traceID, value, err)
			return
		}
		if len(parts) == 2 && r.Method == http.MethodGet && parts[1] == "schema" {
			list, err := s.store.ListTools(serverID)
			if err != nil {
				writeStoreError(w, traceID, err)
				return
			}
			for _, tool := range list.Items {
				if tool.ID == toolID || tool.Name == toolID {
					httpx.WriteJSON(w, 200, map[string]interface{}{"serverId": serverID, "toolId": tool.ID, "name": tool.Name, "inputSchema": tool.InputSchema})
					return
				}
			}
			writeStoreError(w, traceID, db.ErrNotFound)
			return
		}
	}
	httpx.WriteError(w, 404, "NOT_FOUND", "Tool route not found", traceID, nil)
}

func (s *Server) handleGrants(w http.ResponseWriter, r *http.Request, principal db.AuthContext, traceID string) {
	parts := pathParts(r.URL.Path, "/api/grants")
	if len(parts) == 0 {
		if r.Method == http.MethodGet {
			httpx.WriteJSON(w, 200, s.store.ListGrants())
			return
		}
		if r.Method == http.MethodPost {
			if !requireAdmin(w, principal, traceID) {
				return
			}
			var input db.Grant
			if decode(w, r, traceID, &input) {
				value, err := s.store.CreateGrant(input, principal, traceID, input)
				respondStatus(w, traceID, 201, value, err)
			}
			return
		}
	}
	if len(parts) == 1 && r.Method == http.MethodPatch {
		if !requireAdmin(w, principal, traceID) {
			return
		}
		var patch map[string]interface{}
		if decode(w, r, traceID, &patch) {
			value, err := s.store.PatchGrant(parts[0], patch, principal, traceID)
			respond(w, traceID, value, err)
		}
		return
	}
	if len(parts) == 2 && r.Method == http.MethodPost && (parts[1] == "revoke" || parts[1] == "approve") {
		if !requireAdmin(w, principal, traceID) {
			return
		}
		value, err := s.store.SetGrantEnabled(parts[0], parts[1] == "approve", principal, traceID)
		respond(w, traceID, value, err)
		return
	}
	httpx.WriteError(w, 404, "NOT_FOUND", "Grant route not found", traceID, nil)
}

func (s *Server) handleApprovals(w http.ResponseWriter, r *http.Request, principal db.AuthContext, traceID string) {
	parts := pathParts(r.URL.Path, "/api/approvals")
	if len(parts) == 0 {
		if r.Method == http.MethodGet {
			httpx.WriteJSON(w, 200, s.store.ListApprovals())
			return
		}
		if r.Method == http.MethodPost {
			var input db.Approval
			if decode(w, r, traceID, &input) {
				value, err := s.store.CreateApproval(input, principal, traceID, input)
				respondStatus(w, traceID, 201, value, err)
			}
			return
		}
	}
	if len(parts) == 2 && r.Method == http.MethodPost && (parts[1] == "approve" || parts[1] == "reject") {
		if !requireAdmin(w, principal, traceID) {
			return
		}
		var patch map[string]interface{}
		_ = json.NewDecoder(r.Body).Decode(&patch)
		decision := "rejected"
		if parts[1] == "approve" {
			decision = "approved"
		}
		value, err := s.store.DecideApproval(parts[0], decision, patch, principal, traceID)
		respond(w, traceID, value, err)
		return
	}
	httpx.WriteError(w, 404, "NOT_FOUND", "Approval route not found", traceID, nil)
}

func (s *Server) handleAudit(w http.ResponseWriter, r *http.Request, principal db.AuthContext, traceID string) {
	if r.Method == http.MethodGet && r.URL.Path == "/api/audit-events/export/jobs" {
		if !requireAdmin(w, principal, traceID) {
			return
		}
		httpx.WriteJSON(w, 200, s.store.ListAuditExportJobs())
		return
	}
	if r.Method == http.MethodPost && r.URL.Path == "/api/audit-events/export" {
		if !requireAdmin(w, principal, traceID) {
			return
		}
		var input struct {
			Format  string            `json:"format"`
			Filters map[string]string `json:"filters"`
		}
		if decode(w, r, traceID, &input) {
			value, err := s.store.CreateAuditExportJob(input.Filters, input.Format, principal, traceID)
			respondStatus(w, traceID, 202, value, err)
		}
		return
	}
	if r.Method == http.MethodGet && (r.URL.Path == "/api/audit-events" || r.URL.Path == "/api/audit-events/export") {
		limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
		filters := map[string]string{}
		for _, key := range []string{"from", "to", "user", "team", "project", "server", "tool", "event_type", "policy_decision", "risk_level", "trace_id"} {
			filters[key] = r.URL.Query().Get(key)
		}
		httpx.WriteJSON(w, 200, s.store.ListAuditEvents(limit, r.URL.Query().Get("cursor"), filters))
		return
	}
	if r.Method == http.MethodPost && r.URL.Path == "/api/audit-events/gateway" {
		if !requireAdmin(w, principal, traceID) {
			return
		}
		var event db.AuditEvent
		if decode(w, r, traceID, &event) {
			respondStatus(w, traceID, 201, s.store.RecordGatewayAudit(event), nil)
		}
		return
	}
	httpx.WriteError(w, 404, "NOT_FOUND", "Audit route not found", traceID, nil)
}

func (s *Server) handleSecretBindings(w http.ResponseWriter, r *http.Request, principal db.AuthContext, traceID string) {
	if !requireAdmin(w, principal, traceID) {
		return
	}
	parts := pathParts(r.URL.Path, "/api/secret-bindings")
	if len(parts) == 0 {
		if r.Method == http.MethodGet {
			httpx.WriteJSON(w, 200, s.store.ListSecretBindings(filtersFromRequest(r, []string{"scope_type", "scope_id", "provider"})))
			return
		}
		if r.Method == http.MethodPost {
			var raw map[string]interface{}
			if !decode(w, r, traceID, &raw) {
				return
			}
			if containsForbiddenSecretPayload(raw) {
				httpx.WriteError(w, 400, "VALIDATION_ERROR", "Secret binding payload must contain only secret references and lease metadata.", traceID, nil)
				return
			}
			encoded, _ := json.Marshal(raw)
			var input db.SecretBinding
			if err := json.Unmarshal(encoded, &input); err != nil {
				httpx.WriteError(w, 400, "VALIDATION_ERROR", "Request body must be a valid secret binding", traceID, nil)
				return
			}
			value, err := s.store.CreateSecretBinding(input, principal, traceID)
			respondStatus(w, traceID, 201, value, err)
			return
		}
	}
	if len(parts) == 1 && r.Method == http.MethodDelete {
		err := s.store.DeleteSecretBinding(parts[0], principal, traceID)
		respond(w, traceID, map[string]interface{}{"deleted": true, "secretBindingId": parts[0]}, err)
		return
	}
	httpx.WriteError(w, 404, "NOT_FOUND", "Secret binding route not found", traceID, nil)
}

func (s *Server) handleTenancy(w http.ResponseWriter, r *http.Request, principal db.AuthContext, traceID string) {
	if !requireAdmin(w, principal, traceID) {
		return
	}
	parts := pathParts(r.URL.Path, "/api/tenancy")
	if len(parts) == 0 {
		httpx.WriteError(w, 404, "NOT_FOUND", "Tenancy route not found", traceID, nil)
		return
	}
	switch parts[0] {
	case "users":
		if len(parts) == 0 || len(parts) > 1 {
			break
		}
		if r.Method == http.MethodGet {
			httpx.WriteJSON(w, 200, s.store.ListUsers())
			return
		}
		if r.Method == http.MethodPost {
			var input db.User
			if decode(w, r, traceID, &input) {
				value, err := s.store.CreateUser(input, principal, traceID)
				respondStatus(w, traceID, 201, value, err)
			}
			return
		}
	case "teams":
		if len(parts) == 1 {
			if r.Method == http.MethodGet {
				httpx.WriteJSON(w, 200, s.store.ListTeams())
				return
			}
			if r.Method == http.MethodPost {
				var input db.Team
				if decode(w, r, traceID, &input) {
					value, err := s.store.CreateTeam(input, principal, traceID)
					respondStatus(w, traceID, 201, value, err)
				}
				return
			}
		}
		if len(parts) == 3 && parts[2] == "members" && r.Method == http.MethodPost {
			var input db.TeamMembership
			if decode(w, r, traceID, &input) {
				input.TeamID = parts[1]
				value, err := s.store.AddTeamMember(input, principal, traceID)
				respondStatus(w, traceID, 201, value, err)
			}
			return
		}
		if len(parts) == 4 && parts[2] == "members" && r.Method == http.MethodDelete {
			err := s.store.RemoveTeamMember(parts[1], parts[3], principal, traceID)
			respond(w, traceID, map[string]interface{}{"deleted": true, "teamId": parts[1], "userId": parts[3]}, err)
			return
		}
	case "projects":
		if len(parts) == 1 {
			if r.Method == http.MethodGet {
				httpx.WriteJSON(w, 200, s.store.ListProjects())
				return
			}
			if r.Method == http.MethodPost {
				var input db.Project
				if decode(w, r, traceID, &input) {
					value, err := s.store.CreateProject(input, principal, traceID)
					respondStatus(w, traceID, 201, value, err)
				}
				return
			}
		}
		if len(parts) == 3 && parts[2] == "members" && r.Method == http.MethodPost {
			var input db.ProjectMembership
			if decode(w, r, traceID, &input) {
				input.ProjectID = parts[1]
				value, err := s.store.AddProjectMember(input, principal, traceID)
				respondStatus(w, traceID, 201, value, err)
			}
			return
		}
		if len(parts) == 5 && parts[2] == "members" && r.Method == http.MethodDelete {
			err := s.store.RemoveProjectMember(parts[1], db.GrantSubjectType(parts[3]), parts[4], principal, traceID)
			respond(w, traceID, map[string]interface{}{"deleted": true, "projectId": parts[1], "subjectType": parts[3], "subjectId": parts[4]}, err)
			return
		}
	case "policy-input":
		if len(parts) == 1 && r.Method == http.MethodGet {
			userID := r.URL.Query().Get("userId")
			if userID == "" {
				userID = principal.UserID
			}
			value, err := s.store.PolicyInputFor(userID, r.URL.Query().Get("projectId"))
			respond(w, traceID, value, err)
			return
		}
	}
	httpx.WriteError(w, 404, "NOT_FOUND", "Tenancy route not found", traceID, nil)
}

func (s *Server) handleAnalytics(w http.ResponseWriter, r *http.Request, principal db.AuthContext, traceID string) {
	if !requireAdmin(w, principal, traceID) {
		return
	}
	if r.Method != http.MethodGet {
		httpx.WriteError(w, 405, "METHOD_NOT_ALLOWED", "Method not allowed", traceID, nil)
		return
	}
	filters := analyticsFilters(r)
	switch r.URL.Path {
	case "/api/analytics/usage":
		httpx.WriteJSON(w, 200, s.store.UsageReport(filters))
	case "/api/analytics/usage/export":
		w.Header().Set("content-disposition", "attachment; filename=usage-report.csv")
		httpx.WriteText(w, 200, "text/csv", s.store.UsageReportCSV(filters))
	case "/api/analytics/denied-calls":
		httpx.WriteJSON(w, 200, s.store.DeniedCallAnalytics(filters))
	default:
		httpx.WriteError(w, 404, "NOT_FOUND", "Analytics route not found", traceID, nil)
	}
}

func analyticsFilters(r *http.Request) map[string]string {
	filters := map[string]string{}
	for _, key := range []string{"from", "to", "period", "group_by", "user", "team", "project", "client", "server", "tool", "event_type", "policy_decision", "risk_level", "trace_id"} {
		filters[key] = r.URL.Query().Get(key)
	}
	return filters
}

func (s *Server) handleClientConfig(w http.ResponseWriter, r *http.Request, traceID string) {
	var input struct {
		Client   string `json:"client"`
		ServerID string `json:"serverId"`
		Profile  string `json:"profile"`
	}
	if !decode(w, r, traceID, &input) {
		return
	}
	server, err := s.store.GetServer(input.ServerID)
	if err != nil {
		writeStoreError(w, traceID, err)
		return
	}
	url := s.cfg.GatewayURL + "/mcp/" + server.Slug
	client := input.Client
	if client == "" {
		client = "generic"
	}
	profile := input.Profile
	if profile == "" {
		profile = "local"
	}
	authConfig := map[string]interface{}{"type": "bearer", "header": "authorization", "tokenEnv": "MCPHUB_TOKEN", "requiredScope": s.cfg.OIDCRequiredScope}
	config := map[string]interface{}{"transport": "streamable_http", "url": url, "auth": authConfig}
	placeholder := false
	switch client {
	case "opencode":
		config = map[string]interface{}{"mcp": map[string]interface{}{server.Slug: map[string]interface{}{"type": "remote", "url": url, "headers": map[string]interface{}{"authorization": "Bearer ${MCPHUB_TOKEN}"}}}}
	case "claude-code", "codex", "vscode":
		placeholder = true
		config = map[string]interface{}{"mcpServers": map[string]interface{}{server.Slug: map[string]interface{}{"url": url, "headers": map[string]interface{}{"authorization": "Bearer ${MCPHUB_TOKEN}"}, "note": "Placeholder remote MCP client format."}}}
	case "generic":
	default:
		httpx.WriteError(w, 400, "VALIDATION_ERROR", "Unsupported client config kind", traceID, map[string]interface{}{"supportedClients": []string{"generic", "opencode", "claude-code", "codex", "vscode"}})
		return
	}
	httpx.WriteJSON(w, 200, map[string]interface{}{"client": client, "profile": profile, "placeholder": placeholder, "gatewayUrl": url, "serverSlug": server.Slug, "auth": authConfig, "config": config})
}

func (s *Server) handlePolicy(w http.ResponseWriter, r *http.Request, _ db.AuthContext, traceID string) {
	if r.Method != http.MethodPost {
		httpx.WriteError(w, 405, "METHOD_NOT_ALLOWED", "Method not allowed", traceID, nil)
		return
	}
	var input map[string]interface{}
	if !decode(w, r, traceID, &input) {
		return
	}
	result := policy.Allow("Policy document is syntactically valid for the Go control plane.", []string{})
	if strings.HasSuffix(r.URL.Path, "/simulate") || strings.HasSuffix(r.URL.Path, "/test-call") {
		result = policy.Deny("DENY_BY_DEFAULT", "Simulation requires a matching grant in the runtime store.")
	}
	httpx.WriteJSON(w, 200, result)
}

func (s *Server) handleAdmin(w http.ResponseWriter, r *http.Request, principal db.AuthContext, traceID string) {
	if !requireAdmin(w, principal, traceID) {
		return
	}
	if r.Method == http.MethodPost && r.URL.Path == "/api/admin/kill-switch" {
		var input db.KillSwitchRequest
		if decode(w, r, traceID, &input) {
			value, err := s.store.ApplyKillSwitch(input, principal, traceID)
			respond(w, traceID, value, err)
		}
		return
	}
	if r.Method == http.MethodPost && r.URL.Path == "/api/admin/emergency-deny" {
		var input db.EmergencyDeny
		if decode(w, r, traceID, &input) {
			httpx.WriteJSON(w, 200, s.store.SetEmergencyDeny(input, principal, traceID))
		}
		return
	}
	if r.Method == http.MethodPost && r.URL.Path == "/api/admin/emergency-deny/disable" {
		httpx.WriteJSON(w, 200, s.store.DisableEmergencyDeny(principal, traceID))
		return
	}
	parts := pathParts(r.URL.Path, "/api/admin/revoke-server-grants")
	if r.Method == http.MethodPost && len(parts) == 1 {
		value, err := s.store.RevokeServerGrants(parts[0], principal, traceID)
		respond(w, traceID, value, err)
		return
	}
	httpx.WriteError(w, 404, "NOT_FOUND", "Admin route not found", traceID, nil)
}

func (s *Server) rateLimitAPI(w http.ResponseWriter, r *http.Request, principal db.AuthContext, traceID string) bool {
	if !strings.HasPrefix(r.URL.Path, "/api/") || r.URL.Path == "/api/openapi.json" {
		return false
	}
	decision := s.limiter.Check(s.apiRateLimitParts(principal, r))
	writeRateLimitHeaders(w, decision)
	if decision.Error != nil {
		httpx.WriteError(w, 503, "RATE_LIMIT_STORE_FAILED", "Rate limit store unavailable", traceID, map[string]interface{}{"rateLimitKey": decision.Key})
		return true
	}
	if !decision.Allowed {
		httpx.WriteError(w, 429, "RATE_LIMITED", "Rate limit exceeded", traceID, map[string]interface{}{"limit": decision.Limit, "remaining": decision.Remaining, "resetAt": decision.ResetAt.Format(time.RFC3339)})
		return true
	}
	return false
}

func (s *Server) apiRateLimitParts(principal db.AuthContext, r *http.Request) []string {
	team := ""
	if len(principal.TeamIDs) > 0 {
		team = principal.TeamIDs[0]
	}
	serverID, toolID := s.apiRouteDimensions(r.URL.Path)
	return []string{"plane:api", "user:" + principal.UserID, "team:" + team, "project:" + principal.ProjectID, "client:" + principal.ClientID, "server:" + serverID, "tool:" + toolID, "method:" + r.Method, "route:" + apiRouteKey(r.URL.Path)}
}

func (s *Server) apiRouteDimensions(path string) (string, string) {
	parts := pathParts(path, "/api/servers")
	if len(parts) == 0 {
		return "", ""
	}
	serverID := ""
	candidateServerID := parts[0]
	if _, err := s.store.GetServer(candidateServerID); err == nil {
		serverID = candidateServerID
	}
	toolID := ""
	if serverID != "" && len(parts) >= 3 && parts[1] == "tools" {
		candidateToolID := parts[2]
		if tools, err := s.store.ListTools(serverID); err == nil {
			for _, tool := range tools.Items {
				if tool.ID == candidateToolID || tool.Name == candidateToolID {
					toolID = candidateToolID
					break
				}
			}
		}
	}
	return serverID, toolID
}

func apiRouteKey(path string) string {
	switch {
	case path == "/api/me":
		return "/api/me"
	case strings.HasPrefix(path, "/api/servers"):
		return "/api/servers"
	case strings.HasPrefix(path, "/api/grants"):
		return "/api/grants"
	case strings.HasPrefix(path, "/api/approvals"):
		return "/api/approvals"
	case strings.HasPrefix(path, "/api/audit-events"):
		return "/api/audit-events"
	case path == "/api/tool-call-events":
		return "/api/tool-call-events"
	case path == "/api/server-health":
		return "/api/server-health"
	case path == "/api/client-config/generate":
		return "/api/client-config/generate"
	case strings.HasPrefix(path, "/api/policy"):
		return "/api/policy"
	case strings.HasPrefix(path, "/api/admin"):
		return "/api/admin"
	default:
		return "/api/unknown"
	}
}

func writeRateLimitHeaders(w http.ResponseWriter, decision ratelimit.Decision) {
	w.Header().Set("x-ratelimit-limit", fmt.Sprintf("%d", decision.Limit))
	w.Header().Set("x-ratelimit-remaining", fmt.Sprintf("%d", decision.Remaining))
	w.Header().Set("x-ratelimit-reset", decision.ResetAt.Format(time.RFC3339))
	if !decision.Allowed {
		w.Header().Set("retry-after", fmt.Sprintf("%d", int(decision.RetryAfter.Seconds())))
	}
}

func (s *Server) handleRuntime(w http.ResponseWriter, r *http.Request, principal db.AuthContext, traceID string) {
	if r.Method == http.MethodGet && r.URL.Path == "/api/runtime/status" {
		if !requireAdmin(w, principal, traceID) {
			return
		}
		httpx.WriteJSON(w, 200, s.store.ListRuntimeStatus())
		return
	}
	if r.Method == http.MethodGet && r.URL.Path == "/api/runtime/secret-leases" {
		if !requireAdmin(w, principal, traceID) {
			return
		}
		includeRevoked := r.URL.Query().Get("includeRevoked") == "true"
		httpx.WriteJSON(w, 200, s.store.ListSecretLeases(includeRevoked))
		return
	}
	parts := pathParts(r.URL.Path, "/api/runtime/secret-leases")
	if r.Method == http.MethodPost && len(parts) == 2 && parts[1] == "revoke" {
		if !requireAdmin(w, principal, traceID) {
			return
		}
		value, err := s.store.RevokeSecretLease(parts[0], principal, traceID)
		respond(w, traceID, value, err)
		return
	}
	httpx.WriteError(w, 404, "NOT_FOUND", "Runtime route not found", traceID, nil)
}

func requireAdmin(w http.ResponseWriter, principal db.AuthContext, traceID string) bool {
	if auth.RequirePlatformAdmin(principal) {
		return true
	}
	httpx.WriteError(w, 403, "AUTHORIZATION_DENIED", "Platform admin role is required for this action.", traceID, nil)
	return false
}

func respond[T any](w http.ResponseWriter, traceID string, value T, err error) {
	respondStatus(w, traceID, 200, value, err)
}
func respondStatus[T any](w http.ResponseWriter, traceID string, status int, value T, err error) {
	if err != nil {
		writeStoreError(w, traceID, err)
		return
	}
	httpx.WriteJSON(w, status, value)
}
func decode(w http.ResponseWriter, r *http.Request, traceID string, target interface{}) bool {
	if err := httpx.DecodeJSON(r, target); err != nil {
		httpx.WriteError(w, 400, "VALIDATION_ERROR", "Request body must be valid JSON", traceID, map[string]interface{}{"error": err.Error()})
		return false
	}
	return true
}

func writeStoreError(w http.ResponseWriter, traceID string, err error) {
	switch {
	case errors.Is(err, db.ErrNotFound):
		httpx.WriteError(w, 404, "NOT_FOUND", "Resource not found", traceID, nil)
	case errors.Is(err, db.ErrUnauthorized):
		httpx.WriteError(w, 403, "AUTHORIZATION_DENIED", "Authorization denied", traceID, nil)
	case errors.Is(err, db.ErrValidation):
		httpx.WriteError(w, 400, "VALIDATION_ERROR", strings.TrimPrefix(err.Error(), db.ErrValidation.Error()+": "), traceID, nil)
	default:
		httpx.WriteError(w, 500, "INTERNAL_SERVER_ERROR", err.Error(), traceID, nil)
	}
}

func pathParts(path, prefix string) []string {
	rest := strings.Trim(strings.TrimPrefix(path, prefix), "/")
	if rest == "" {
		return nil
	}
	return strings.Split(rest, "/")
}

func listOptionsFromRequest(r *http.Request, filterKeys []string) db.ListOptions {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	return db.ListOptions{Limit: limit, Cursor: r.URL.Query().Get("cursor"), Filters: filtersFromRequest(r, filterKeys)}
}

func filtersFromRequest(r *http.Request, keys []string) map[string]string {
	filters := map[string]string{}
	for _, key := range keys {
		filters[key] = r.URL.Query().Get(key)
	}
	return filters
}

func containsForbiddenSecretPayload(value map[string]interface{}) bool {
	for key := range value {
		switch strings.ToLower(key) {
		case "secret", "secretvalue", "plaintext", "value", "token", "password", "raw":
			return true
		}
	}
	return false
}

func OpenAPIDocument() map[string]interface{} { return openAPIDocument() }

func openAPIDocument() map[string]interface{} {
	return map[string]interface{}{
		"openapi": "3.1.0",
		"info":    map[string]interface{}{"title": "MCP Hub Control Plane API", "version": "0.1.0"},
		"paths": map[string]interface{}{
			"/healthz":                           map[string]interface{}{"get": operation("Health check", false)},
			"/readyz":                            map[string]interface{}{"get": operation("Readiness check", false)},
			"/metrics":                           map[string]interface{}{"get": operation("Prometheus metrics", false)},
			"/api/me":                            map[string]interface{}{"get": operation("Current auth context", false)},
			"/api/servers":                       map[string]interface{}{"get": operation("List MCP servers", false), "post": operation("Register MCP server", true, 201)},
			"/api/servers/{serverId}":            map[string]interface{}{"get": operation("Get MCP server", false), "patch": operation("Patch MCP server", true), "delete": operation("Delete MCP server", true)},
			"/api/servers/{serverId}/publish":    map[string]interface{}{"post": operation("Publish server", true)},
			"/api/servers/{serverId}/unpublish":  map[string]interface{}{"post": operation("Unpublish server", true)},
			"/api/servers/{serverId}/disable":    map[string]interface{}{"post": operation("Disable server", true)},
			"/api/servers/{serverId}/enable":     map[string]interface{}{"post": operation("Enable server", true)},
			"/api/servers/{serverId}/quarantine": map[string]interface{}{"post": operation("Quarantine server", true)},
			"/api/servers/{serverId}/rollout":    map[string]interface{}{"get": operation("Get server rollout status", false)},
			"/api/servers/{serverId}/versions":   map[string]interface{}{"get": adminOperation("List server versions", false), "post": adminOperation("Create server version", true, 201)},
			"/api/servers/{serverId}/versions/{versionId}/activate": map[string]interface{}{"post": adminOperation("Activate server version", true)},
			"/api/servers/{serverId}/versions/{versionId}/rollback": map[string]interface{}{"post": adminOperation("Roll back server version", true)},
			"/api/servers/{serverId}/schema-diff":                   map[string]interface{}{"get": operation("Get server schema diff", false)},
			"/api/servers/{serverId}/schema-diff/history":           map[string]interface{}{"get": operation("List server schema diff history", false)},
			"/api/servers/{serverId}/schema-snapshots":              map[string]interface{}{"get": operation("List server schema snapshots", false), "post": operation("Record server schema snapshot", true, 201)},
			"/api/servers/{serverId}/runtime":                       map[string]interface{}{"get": adminOperation("Get server runtime status", false)},
			"/api/servers/{serverId}/tools":                         map[string]interface{}{"get": operation("List server tools", false)},
			"/api/servers/{serverId}/tools/{toolId}":                map[string]interface{}{"patch": operation("Patch server tool", true)},
			"/api/servers/{serverId}/tools/{toolId}/enable":         map[string]interface{}{"post": operation("Enable server tool", true)},
			"/api/servers/{serverId}/tools/{toolId}/disable":        map[string]interface{}{"post": operation("Disable server tool", true)},
			"/api/servers/{serverId}/tools/{toolId}/schema":         map[string]interface{}{"get": operation("Get tool schema", false)},
			"/api/grants":                                  map[string]interface{}{"get": operation("List grants", false), "post": operation("Create grant request", true, 201)},
			"/api/grants/{grantId}":                        map[string]interface{}{"patch": operation("Patch grant", true)},
			"/api/grants/{grantId}/approve":                map[string]interface{}{"post": operation("Approve grant", true)},
			"/api/grants/{grantId}/revoke":                 map[string]interface{}{"post": operation("Revoke grant", true)},
			"/api/approvals":                               map[string]interface{}{"get": operation("List approvals", false), "post": operation("Create approval request", true, 201)},
			"/api/approvals/{approvalId}/approve":          map[string]interface{}{"post": operation("Approve approval request", true)},
			"/api/approvals/{approvalId}/reject":           map[string]interface{}{"post": operation("Reject approval request", true)},
			"/api/audit-events":                            map[string]interface{}{"get": operation("Search audit events", false)},
			"/api/audit-events/export":                     map[string]interface{}{"get": operation("Export audit events", false), "post": operation("Create audit export job", true, 202)},
			"/api/audit-events/export/jobs":                map[string]interface{}{"get": operation("List audit export jobs", true)},
			"/api/audit-events/gateway":                    map[string]interface{}{"post": operation("Record gateway audit event", true, 201)},
			"/api/secret-bindings":                         map[string]interface{}{"get": operation("List secret bindings", true), "post": operation("Create secret binding", true, 201)},
			"/api/secret-bindings/{secretBindingId}":       map[string]interface{}{"delete": operation("Delete secret binding", true)},
			"/api/tenancy/users":                           map[string]interface{}{"get": operation("List tenancy users", true), "post": operation("Create tenancy user", true, 201)},
			"/api/tenancy/teams":                           map[string]interface{}{"get": operation("List tenancy teams", true), "post": operation("Create tenancy team", true, 201)},
			"/api/tenancy/teams/{teamId}/members":          map[string]interface{}{"post": operation("Add team member", true, 201)},
			"/api/tenancy/teams/{teamId}/members/{userId}": map[string]interface{}{"delete": operation("Remove team member", true)},
			"/api/tenancy/projects":                        map[string]interface{}{"get": operation("List tenancy projects", true), "post": operation("Create tenancy project", true, 201)},
			"/api/tenancy/projects/{projectId}/members":    map[string]interface{}{"post": operation("Add project member", true, 201)},
			"/api/tenancy/projects/{projectId}/members/{subjectType}/{subjectId}": map[string]interface{}{"delete": operation("Remove project member", true)},
			"/api/tenancy/policy-input":                   map[string]interface{}{"get": operation("Get tenancy policy input", true)},
			"/api/tool-call-events":                       map[string]interface{}{"get": operation("List tool call events", false)},
			"/api/server-health":                          map[string]interface{}{"get": operation("List server health records", false)},
			"/api/analytics/usage":                        map[string]interface{}{"get": analyticsOperation("Get usage accounting report", usageAnalyticsParameters())},
			"/api/analytics/usage/export":                 map[string]interface{}{"get": analyticsOperation("Export usage accounting report", usageAnalyticsParameters())},
			"/api/analytics/denied-calls":                 map[string]interface{}{"get": analyticsOperation("Get denied-call analytics", deniedAnalyticsParameters())},
			"/api/client-config/generate":                 map[string]interface{}{"post": operation("Generate client config", false)},
			"/api/policy/validate":                        map[string]interface{}{"post": operation("Validate policy", false)},
			"/api/policy/simulate":                        map[string]interface{}{"post": operation("Simulate policy", false)},
			"/api/policy/test-call":                       map[string]interface{}{"post": operation("Simulate one policy-protected tool call", false)},
			"/api/admin/kill-switch":                      map[string]interface{}{"post": operation("Apply admin kill switch", true)},
			"/api/admin/emergency-deny":                   map[string]interface{}{"post": operation("Enable emergency deny", true)},
			"/api/admin/emergency-deny/disable":           map[string]interface{}{"post": operation("Disable emergency deny", true)},
			"/api/admin/revoke-server-grants/{serverId}":  map[string]interface{}{"post": operation("Revoke all grants for one server", true)},
			"/api/runtime/status":                         map[string]interface{}{"get": adminOperation("List runtime render status", false)},
			"/api/runtime/secret-leases":                  map[string]interface{}{"get": adminOperation("List runtime secret leases", false)},
			"/api/runtime/secret-leases/{leaseId}/revoke": map[string]interface{}{"post": adminOperation("Revoke runtime secret lease", true)},
		},
		"components": map[string]interface{}{"schemas": map[string]interface{}{"ErrorResponse": map[string]interface{}{"type": "object", "required": []string{"error", "traceId"}}}},
	}
}

func operation(summary string, audit bool, statuses ...int) map[string]interface{} {
	if len(statuses) == 0 {
		statuses = []int{200}
	}
	responses := map[string]interface{}{}
	for _, status := range statuses {
		responses[strconv.Itoa(status)] = map[string]interface{}{"description": summary}
	}
	out := map[string]interface{}{"summary": summary, "responses": responses}
	if audit {
		out["x-audit-event-required"] = true
	}
	return out
}

func adminOperation(summary string, audit bool, statuses ...int) map[string]interface{} {
	out := operation(summary, audit, statuses...)
	out["x-admin-required"] = true
	out["responses"].(map[string]interface{})["403"] = map[string]interface{}{"description": "Platform admin required"}
	return out
}

func analyticsOperation(summary string, parameters []map[string]interface{}) map[string]interface{} {
	out := operation(summary, false)
	out["x-platform-admin-required"] = true
	out["parameters"] = parameters
	responses := out["responses"].(map[string]interface{})
	responses["403"] = map[string]interface{}{"description": "Platform admin required"}
	return out
}

func usageAnalyticsParameters() []map[string]interface{} {
	return []map[string]interface{}{
		queryParameter("from", map[string]interface{}{"type": "string", "format": "date-time"}),
		queryParameter("to", map[string]interface{}{"type": "string", "format": "date-time"}),
		queryParameter("period", map[string]interface{}{"type": "string", "enum": []string{"daily", "monthly"}}),
		queryParameter("group_by", map[string]interface{}{"type": "string"}),
		queryParameter("team", map[string]interface{}{"type": "string"}),
		queryParameter("project", map[string]interface{}{"type": "string"}),
		queryParameter("user", map[string]interface{}{"type": "string"}),
		queryParameter("client", map[string]interface{}{"type": "string"}),
		queryParameter("server", map[string]interface{}{"type": "string"}),
		queryParameter("tool", map[string]interface{}{"type": "string"}),
		queryParameter("event_type", map[string]interface{}{"type": "string"}),
		queryParameter("policy_decision", map[string]interface{}{"type": "string", "enum": []string{"allow", "deny", "needs_approval"}}),
		queryParameter("risk_level", map[string]interface{}{"type": "string", "enum": []string{"low", "medium", "high", "critical"}}),
		queryParameter("trace_id", map[string]interface{}{"type": "string"}),
	}
}

func deniedAnalyticsParameters() []map[string]interface{} {
	return []map[string]interface{}{
		queryParameter("from", map[string]interface{}{"type": "string", "format": "date-time"}),
		queryParameter("to", map[string]interface{}{"type": "string", "format": "date-time"}),
		queryParameter("server", map[string]interface{}{"type": "string"}),
		queryParameter("tool", map[string]interface{}{"type": "string"}),
		queryParameter("user", map[string]interface{}{"type": "string"}),
		queryParameter("team", map[string]interface{}{"type": "string"}),
		queryParameter("project", map[string]interface{}{"type": "string"}),
		queryParameter("client", map[string]interface{}{"type": "string"}),
		queryParameter("risk_level", map[string]interface{}{"type": "string", "enum": []string{"low", "medium", "high", "critical"}}),
		queryParameter("trace_id", map[string]interface{}{"type": "string"}),
	}
}

func queryParameter(name string, schema map[string]interface{}) map[string]interface{} {
	return map[string]interface{}{"name": name, "in": "query", "schema": schema}
}

func ListenAndServe(store *db.Store, cfg config.Config) error {
	shutdown, err := telemetry.Init(context.Background(), "api")
	if err != nil {
		return err
	}
	defer shutdown(context.Background())
	address := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	return http.ListenAndServe(address, NewServer(store, cfg).Handler())
}
