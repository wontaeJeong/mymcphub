package gateway

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/mcp-hub/mcp-hub/internal/audit"
	"github.com/mcp-hub/mcp-hub/internal/auth"
	"github.com/mcp-hub/mcp-hub/internal/config"
	"github.com/mcp-hub/mcp-hub/internal/db"
	"github.com/mcp-hub/mcp-hub/internal/httpx"
	"github.com/mcp-hub/mcp-hub/internal/logger"
	"github.com/mcp-hub/mcp-hub/internal/mcp"
	"github.com/mcp-hub/mcp-hub/internal/policy"
	"github.com/mcp-hub/mcp-hub/internal/ratelimit"
	"github.com/mcp-hub/mcp-hub/internal/redaction"
	"github.com/mcp-hub/mcp-hub/internal/telemetry"
)

type Upstream interface {
	Call(ctx context.Context, server db.MCPServer, request mcp.Request, traceID string) (mcp.Response, int, error)
}

type Server struct {
	store      *db.Store
	cfg        config.Config
	log        logger.Logger
	upstream   Upstream
	breaker    *CircuitBreaker
	limiter    *ratelimit.Limiter
	sessions   *SessionManager
	stepUps    *StepUpTokens
	metrics    *GatewayMetrics
	registryMu sync.RWMutex
	registry   map[string]db.GatewayServerSnapshot
}

func NewServer(store *db.Store, cfg config.Config, upstream Upstream) *Server {
	if store == nil {
		store = db.NewSeedStore()
	}
	if upstream == nil {
		upstream = HTTPUpstream{}
	}
	server := &Server{
		store:    store,
		cfg:      cfg,
		log:      logger.New("gateway"),
		upstream: upstream,
		breaker:  NewCircuitBreaker(cfg.CircuitThreshold(), time.Duration(cfg.CircuitOpenSeconds())*time.Second),
		limiter:  ratelimit.NewStore(cfg.GatewayRateLimit, time.Duration(cfg.RateLimitWindow())*time.Second, store),
		sessions: NewSessionManager(time.Duration(cfg.SessionIdleSeconds()) * time.Second),
		stepUps:  NewStepUpTokens(5 * time.Minute),
		metrics:  NewGatewayMetrics(),
		registry: map[string]db.GatewayServerSnapshot{},
	}
	_ = server.reloadRegistry("startup")
	return server
}
func (s *Server) Handler() http.Handler {
	return telemetry.Handler("gateway", http.HandlerFunc(s.handle))
}

func (s *Server) handle(w http.ResponseWriter, r *http.Request) {
	finish := s.store.BeginRequest(gatewayWrites(r))
	defer finish()
	traceID := auth.TraceID(r)
	w.Header().Set("x-trace-id", traceID)
	started := time.Now()
	s.metrics.RecordRequest()
	s.log.InfoContext(r.Context(), "gateway.request", map[string]interface{}{"method": r.Method, "path": r.URL.Path})
	if r.URL.Path == "/healthz" && r.Method == http.MethodGet {
		httpx.WriteJSON(w, 200, map[string]string{"service": "gateway", "status": "ok"})
		return
	}
	if r.URL.Path == "/readyz" && r.Method == http.MethodGet {
		httpx.WriteJSON(w, 200, map[string]interface{}{"service": "gateway", "status": "ready", "dependencies": map[string]string{"store": "ready"}})
		return
	}
	if r.URL.Path == "/metrics" && r.Method == http.MethodGet {
		httpx.WriteText(w, 200, "text/plain; version=0.0.4", s.metrics.Render(s.sessions.Active())+"\n"+telemetry.MetricsText("gateway"))
		return
	}
	reloadErr := s.reloadRegistry("request")

	parts := pathParts(r.URL.Path, "/mcp")
	if len(parts) != 1 {
		s.recordDetailed(traceID, db.AuthContext{}, "server.connect.denied", "", "", db.RiskLow, db.PolicyDeny, "GATEWAY_ROUTE_NOT_FOUND", started, nil, "", map[string]interface{}{"path": r.URL.Path})
		httpx.WriteError(w, 404, "GATEWAY_ROUTE_NOT_FOUND", "Gateway route not found.", traceID, nil)
		return
	}
	principal, bearerErr := auth.PrincipalFromBearerDetailed(r)
	if bearerErr != nil {
		s.recordDetailed(traceID, db.AuthContext{}, "auth.failure", "", "", db.RiskLow, db.PolicyDeny, bearerErr.Code, started, nil, "", map[string]interface{}{"path": r.URL.Path})
		writeBearerError(w, traceID, bearerErr)
		return
	}
	if _, err := s.store.ValidateOAuthClient(principal.ClientID, principal.RedirectURI, s.cfg.GatewayAllowDynamicClients); err != nil {
		s.recordDetailed(traceID, principal, "auth.failure", "", "", db.RiskLow, db.PolicyDeny, "CLIENT_NOT_REGISTERED", started, nil, "", map[string]interface{}{"clientId": principal.ClientID})
		httpx.WriteError(w, 403, "CLIENT_NOT_REGISTERED", "MCP client is not registered or redirect_uri is not allowed.", traceID, map[string]interface{}{"clientId": principal.ClientID})
		return
	}

	snapshot, ok := s.resolveServer(parts[0])
	if !ok {
		s.recordDetailed(traceID, principal, "server.connect.denied", "", "", db.RiskLow, db.PolicyDeny, "MCP_SERVER_NOT_FOUND", started, nil, "", map[string]interface{}{"serverSlug": parts[0]})
		httpx.WriteError(w, 404, "MCP_SERVER_NOT_FOUND", "MCP server slug is not registered.", traceID, map[string]interface{}{"serverSlug": parts[0]})
		return
	}
	server, tools, grants, emergency := snapshot.Server, snapshot.Tools, snapshot.Grants, snapshot.EmergencyDeny
	connectDecision := policy.EvaluateConnect(principal, server, grants, emergency)
	routeMetadata := routeDecisionMetadata(server, connectDecision, reloadErr)
	if !connectDecision.Allowed {
		s.recordDetailed(traceID, principal, "server.connect.denied", server.ID, "", server.RiskLevel, connectDecision.Effect, connectDecision.ReasonCode, started, nil, "", routeMetadata)
		httpx.WriteError(w, 403, connectDecision.ReasonCode, connectDecision.Reason, traceID, map[string]interface{}{"serverId": server.ID, "serverSlug": server.Slug})
		return
	}
	s.recordDetailed(traceID, principal, "server.connect.allowed", server.ID, "", server.RiskLevel, db.PolicyAllow, "", started, nil, "", routeMetadata)

	if r.Method == http.MethodGet {
		httpx.WriteJSON(w, 200, map[string]interface{}{"server": map[string]interface{}{"id": server.ID, "slug": server.Slug, "transport": server.Transport}, "circuitState": s.breaker.State(server.Slug), "sessionIdleSeconds": s.cfg.SessionIdleSeconds(), "reloadError": errorString(reloadErr)})
		return
	}
	if r.Method != http.MethodPost {
		s.record(traceID, principal, "server.connect.denied", server.ID, "", server.RiskLevel, db.PolicyDeny, "METHOD_NOT_ALLOWED", started, nil)
		httpx.WriteError(w, 405, "METHOD_NOT_ALLOWED", "Method not allowed for MCP Gateway route.", traceID, nil)
		return
	}

	var body interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		s.record(traceID, principal, "tool.call.failed", server.ID, "", server.RiskLevel, db.PolicyDeny, "JSON_RPC_PARSE_ERROR", started, nil)
		httpx.WriteJSON(w, 400, mcp.Error(nil, -32700, "Parse error"))
		return
	}
	request, err := mcp.ParseRequest(body)
	if err != nil {
		s.record(traceID, principal, "tool.call.failed", server.ID, "", server.RiskLevel, db.PolicyDeny, "JSON_RPC_INVALID_REQUEST", started, nil)
		httpx.WriteJSON(w, 400, mcp.Error(nil, -32600, "Invalid Request"))
		return
	}
	rate := s.limiter.Check(rateLimitParts(principal, server, toolName(request), request.Method))
	writeRateLimitHeaders(w, rate)
	if rate.Error != nil {
		s.recordDetailed(traceID, principal, "server.connect.denied", server.ID, toolName(request), server.RiskLevel, db.PolicyDeny, "RATE_LIMIT_STORE_FAILED", started, nil, sessionIDFromRequest(r), map[string]interface{}{"rateLimitKey": rate.Key})
		httpx.WriteJSON(w, 503, mcp.ErrorData(request.ID, -32030, "Rate limit store unavailable", map[string]interface{}{"code": "RATE_LIMIT_STORE_FAILED"}))
		return
	}
	if !rate.Allowed {
		s.metrics.RecordRateLimited()
		s.recordDetailed(traceID, principal, "server.connect.denied", server.ID, toolName(request), server.RiskLevel, db.PolicyDeny, "RATE_LIMITED", started, nil, sessionIDFromRequest(r), map[string]interface{}{"rateLimitKey": rate.Key, "rateLimitResetAt": rate.ResetAt.Format(time.RFC3339)})
		httpx.WriteJSON(w, 429, mcp.ErrorData(request.ID, -32029, "Rate limit exceeded", map[string]interface{}{"code": "RATE_LIMITED", "limit": rate.Limit, "remaining": rate.Remaining, "resetAt": rate.ResetAt.Format(time.RFC3339)}))
		return
	}
	session := s.sessions.Resolve(r, request, principal, server)
	if session.ID != "" {
		w.Header().Set("mcp-session-id", session.ID)
		w.Header().Set("x-mcp-session-id", session.ID)
	}
	if session.ErrorCode != "" {
		s.recordDetailed(traceID, principal, "session.failed", server.ID, toolName(request), server.RiskLevel, db.PolicyDeny, session.ErrorCode, started, nil, session.ID, routeMetadata)
		httpx.WriteJSON(w, 401, mcp.ErrorData(request.ID, -32004, session.Message, map[string]interface{}{"code": session.ErrorCode}))
		return
	}
	status, response := s.handleMCP(r.Context(), request, principal, server, tools, grants, emergency, traceID, started, session.ID, r.Header.Get("x-mcp-step-up-token"))
	httpx.WriteJSON(w, status, response)
}

func gatewayWrites(r *http.Request) bool {
	return !(r.Method == http.MethodGet && (r.URL.Path == "/healthz" || r.URL.Path == "/readyz" || r.URL.Path == "/metrics"))
}

func (s *Server) handleMCP(ctx context.Context, request mcp.Request, principal db.AuthContext, server db.MCPServer, tools []db.MCPTool, grants []db.Grant, emergency *db.EmergencyDeny, traceID string, started time.Time, sessionID string, stepUpToken string) (int, mcp.Response) {
	if request.Method == "initialize" {
		s.recordDetailed(traceID, principal, "session.created", server.ID, "", server.RiskLevel, db.PolicyAllow, "", started, request.Params, sessionID, map[string]interface{}{"serverSlug": server.Slug})
		return 200, mcp.Result(request.ID, map[string]interface{}{"protocolVersion": "2025-03-26", "capabilities": map[string]interface{}{"tools": map[string]interface{}{}, "resources": map[string]interface{}{}, "prompts": map[string]interface{}{}}, "serverInfo": map[string]interface{}{"name": server.Slug, "version": "0.1.0"}, "sessionId": sessionID})
	}
	if request.Method == "notifications/initialized" {
		s.sessions.MarkInitialized(sessionID)
		s.recordDetailed(traceID, principal, "session.initialized", server.ID, "", server.RiskLevel, db.PolicyAllow, "", started, nil, sessionID, map[string]interface{}{"serverSlug": server.Slug})
		return 202, mcp.Result(request.ID, map[string]interface{}{"accepted": true, "sessionId": sessionID})
	}
	if request.Method == "tools/list" {
		decision := policy.EvaluateDiscovery(principal, server, tools, grants, emergency)
		if !decision.Allowed {
			s.recordDetailed(traceID, principal, "tool.discovery.filtered", server.ID, "", server.RiskLevel, decision.Effect, decision.ReasonCode, started, nil, sessionID, policyTrace(decision, 0))
			return 200, mcp.ErrorData(request.ID, -32001, decision.Reason, policyErrorData(decision, server, ""))
		}
		allowed := make([]map[string]interface{}, 0, len(decision.DiscoverableToolNames))
		for _, tool := range tools {
			if contains(decision.DiscoverableToolNames, tool.Name) {
				allowed = append(allowed, map[string]interface{}{"name": tool.Name, "description": tool.Description, "inputSchema": tool.InputSchema})
			}
		}
		filteredCount := len(tools) - len(allowed)
		if filteredCount > 0 {
			s.metrics.RecordDiscoveryFiltered(filteredCount)
		}
		eventType := "tool.discovery.allowed"
		if filteredCount > 0 {
			eventType = "tool.discovery.filtered"
		}
		s.recordDetailed(traceID, principal, eventType, server.ID, "", server.RiskLevel, db.PolicyAllow, "", started, nil, sessionID, policyTrace(decision, filteredCount))
		return 200, mcp.Result(request.ID, map[string]interface{}{"tools": allowed, "_meta": map[string]interface{}{"filteredCount": filteredCount, "policyDecision": decision.ReasonCode, "matchedGrantIds": decision.MatchedGrantIDs}})
	}
	toolName := toolName(request)
	tool, foundTool := findTool(tools, toolName)
	if request.Method == "tools/call" {
		stepUp := s.stepUps.Consume(stepUpToken, principal, server.ID, toolName)
		decision := policy.EvaluateToolCall(principal, server, tool, grants, emergency, stepUp)
		redactedArgs := redaction.Redact(args(request))
		if !foundTool || !decision.Allowed {
			data := policyErrorData(decision, server, toolName)
			auditData := policyErrorData(decision, server, toolName)
			if decision.RequiresApproval {
				if approvalID := s.ensureApprovalRequest(principal, server, toolName, traceID, redactedArgs); approvalID != "" {
					data["approvalId"] = approvalID
					auditData["approvalId"] = approvalID
				}
			}
			if decision.RequiresStepUp && foundTool {
				data["stepUpToken"] = s.stepUps.Issue(principal, server.ID, toolName)
				data["stepUpTokenHeader"] = "x-mcp-step-up-token"
				auditData["stepUpTokenIssued"] = true
				auditData["stepUpTokenHeader"] = "x-mcp-step-up-token"
			}
			eventType := "tool.call.denied"
			if decision.RequiresApproval || decision.RequiresStepUp {
				eventType = "approval.requested"
			}
			s.recordDetailed(traceID, principal, eventType, server.ID, toolName, riskFor(tool, server), decision.Effect, decision.ReasonCode, started, redactedArgs, sessionID, auditData)
			return 200, mcp.ErrorData(request.ID, -32001, decision.Reason, data)
		}
		s.recordDetailed(traceID, principal, "tool.call.allowed", server.ID, toolName, tool.RiskLevel, db.PolicyAllow, "", started, redactedArgs, sessionID, map[string]interface{}{"stepUp": stepUp})
	}
	if !supported(request.Method) {
		s.recordDetailed(traceID, principal, "server.connect.denied", server.ID, toolName, riskFor(tool, server), db.PolicyDeny, "MCP_METHOD_UNSUPPORTED", started, redaction.Redact(args(request)), sessionID, map[string]interface{}{"method": request.Method})
		return 200, mcp.ErrorData(request.ID, -32601, "Unsupported MCP method "+request.Method, map[string]interface{}{"code": "MCP_METHOD_UNSUPPORTED"})
	}
	state := s.breaker.State(server.Slug)
	if state == "open" {
		s.recordDetailed(traceID, principal, "tool.call.failed", server.ID, toolName, riskFor(tool, server), db.PolicyDeny, "UPSTREAM_CIRCUIT_OPEN", started, redaction.Redact(args(request)), sessionID, map[string]interface{}{"circuitState": state})
		return 503, mcp.ErrorData(request.ID, -32002, "Upstream circuit is open", map[string]interface{}{"code": "UPSTREAM_CIRCUIT_OPEN", "circuitState": state})
	}
	if err := validateUpstreamURL(server.UpstreamURL); err != nil {
		s.recordDetailed(traceID, principal, "tool.call.failed", server.ID, toolName, riskFor(tool, server), db.PolicyDeny, "UPSTREAM_URL_BLOCKED", started, redaction.Redact(args(request)), sessionID, map[string]interface{}{"upstreamHost": upstreamHost(server.UpstreamURL)})
		return 502, mcp.ErrorData(request.ID, -32003, err.Error(), map[string]interface{}{"code": "UPSTREAM_URL_BLOCKED"})
	}
	callCtx, cancel := context.WithTimeout(ctx, upstreamTimeout(server, s.cfg))
	defer cancel()
	upstreamStarted := time.Now()
	response, upstreamStatus, err := s.upstream.Call(callCtx, server, request, traceID)
	s.metrics.RecordUpstreamLatency(time.Since(upstreamStarted))
	if err != nil {
		s.breaker.RecordFailure(server.Slug)
		s.recordDetailed(traceID, principal, "tool.call.failed", server.ID, toolName, riskFor(tool, server), db.PolicyDeny, err.Error(), started, redaction.Redact(args(request)), sessionID, map[string]interface{}{"circuitState": s.breaker.State(server.Slug)})
		return 502, mcp.ErrorData(request.ID, -32003, err.Error(), map[string]interface{}{"code": err.Error()})
	}
	s.breaker.RecordSuccess(server.Slug)
	eventType := "server.connect.allowed"
	if request.Method == "tools/call" {
		eventType = "tool.call.succeeded"
	}
	event := audit.NewEvent(eventType, principal, traceID, server.ID, toolName, riskFor(tool, server), db.PolicyAllow)
	event.SessionID = sessionID
	event.LatencyMS = int(time.Since(started).Milliseconds())
	event.UpstreamStatus = upstreamStatus
	event.ArgumentRedactedJSON = redaction.Redact(args(request))
	event.ArgumentHash = redaction.Hash(args(request))
	event.MetadataJSON = mergeMetadata(event.MetadataJSON, map[string]interface{}{"circuitState": s.breaker.State(server.Slug), "method": request.Method})
	s.store.AddAudit(event)
	telemetry.RecordMCPCall("gateway", request.Method, string(db.PolicyAllow), "succeeded", time.Since(started))
	return 200, response
}

func (s *Server) record(traceID string, principal db.AuthContext, eventType, serverID, toolName string, risk db.RiskLevel, decision db.PolicyEffect, errorCode string, started time.Time, argument interface{}) {
	s.recordDetailed(traceID, principal, eventType, serverID, toolName, risk, decision, errorCode, started, argument, "", nil)
}

func (s *Server) recordDetailed(traceID string, principal db.AuthContext, eventType, serverID, toolName string, risk db.RiskLevel, decision db.PolicyEffect, errorCode string, started time.Time, argument interface{}, sessionID string, metadata map[string]interface{}) {
	duration := time.Since(started)
	event := audit.NewEvent(eventType, principal, traceID, serverID, toolName, risk, decision)
	event.SessionID = sessionID
	event.LatencyMS = int(duration.Milliseconds())
	event.ErrorCode = errorCode
	event.ArgumentRedactedJSON = redaction.Redact(argument)
	if argument != nil {
		event.ArgumentHash = redaction.Hash(argument)
	}
	event.MetadataJSON = mergeMetadata(event.MetadataJSON, metadata)
	s.store.AddAudit(event)
	if strings.HasPrefix(eventType, "tool.call") {
		telemetry.RecordMCPCall("gateway", "tools/call", string(decision), strings.TrimPrefix(eventType, "tool.call."), duration)
	}
	if decision == db.PolicyDeny {
		telemetry.RecordPolicyDeny("gateway", errorCode)
	}
	if strings.HasPrefix(errorCode, "UPSTREAM") {
		telemetry.RecordUpstreamError("gateway", errorCode)
	}
}

func (s *Server) reloadRegistry(reason string) error {
	if err := s.store.Refresh(); err != nil {
		s.metrics.RecordReloadFailure(err)
		return err
	}
	snapshots := s.store.SnapshotGatewayRegistry()
	next := make(map[string]db.GatewayServerSnapshot, len(snapshots))
	for _, snapshot := range snapshots {
		slug := strings.TrimSpace(snapshot.Server.Slug)
		if slug == "" {
			err := errors.New("gateway registry contains an empty server slug")
			s.metrics.RecordReloadFailure(err)
			return err
		}
		if _, exists := next[slug]; exists {
			err := fmt.Errorf("gateway registry contains duplicate server slug %q", slug)
			s.metrics.RecordReloadFailure(err)
			return err
		}
		next[slug] = snapshot
	}
	s.registryMu.Lock()
	s.registry = next
	s.registryMu.Unlock()
	s.metrics.RecordReloadSuccess(reason)
	return nil
}

func (s *Server) resolveServer(slug string) (db.GatewayServerSnapshot, bool) {
	s.registryMu.RLock()
	defer s.registryMu.RUnlock()
	snapshot, ok := s.registry[slug]
	return snapshot, ok
}

func (s *Server) ensureApprovalRequest(principal db.AuthContext, server db.MCPServer, toolName string, traceID string, argument interface{}) string {
	approval, err := s.store.CreateApproval(db.Approval{SubjectType: principal.PrincipalType, SubjectID: principal.UserID, ProjectID: principal.ProjectID, ServerID: server.ID, RequestedTools: []string{toolName}, Environment: server.Environment, ToolName: toolName, RequestedAction: "call_tool", Reason: "Gateway policy requires approval for this tool call."}, principal, traceID, argument)
	if err != nil {
		return ""
	}
	if err := s.store.Save(); err != nil {
		s.log.Error("gateway.approval.save.failed", map[string]interface{}{"traceId": traceID, "error": err.Error()})
	}
	return approval.ID
}

func writeBearerError(w http.ResponseWriter, traceID string, err *auth.BearerError) {
	w.Header().Set("www-authenticate", err.Challenge())
	httpx.WriteError(w, err.Status, err.Code, err.Description, traceID, map[string]interface{}{"oauthError": err.Error, "scope": err.Scope})
}

func writeRateLimitHeaders(w http.ResponseWriter, decision ratelimit.Decision) {
	w.Header().Set("x-ratelimit-limit", fmt.Sprintf("%d", decision.Limit))
	w.Header().Set("x-ratelimit-remaining", fmt.Sprintf("%d", decision.Remaining))
	w.Header().Set("x-ratelimit-reset", decision.ResetAt.Format(time.RFC3339))
	if !decision.Allowed {
		w.Header().Set("retry-after", fmt.Sprintf("%d", int(decision.RetryAfter.Seconds())))
	}
}

func rateLimitParts(principal db.AuthContext, server db.MCPServer, toolName string, method string) []string {
	team := ""
	if len(principal.TeamIDs) > 0 {
		team = principal.TeamIDs[0]
	}
	return []string{"user:" + principal.UserID, "team:" + team, "project:" + principal.ProjectID, "client:" + principal.ClientID, "server:" + server.ID, "tool:" + toolName, "method:" + method}
}

func routeDecisionMetadata(server db.MCPServer, decision policy.Decision, reloadErr error) map[string]interface{} {
	metadata := map[string]interface{}{"serverSlug": server.Slug, "transport": string(server.Transport), "policyDecision": decision.ReasonCode, "matchedGrantIds": decision.MatchedGrantIDs}
	if reloadErr != nil {
		metadata["reloadError"] = reloadErr.Error()
	}
	return metadata
}

func upstreamHost(raw string) string {
	parsed, err := url.Parse(raw)
	if err != nil {
		return ""
	}
	return parsed.Hostname()
}

func policyTrace(decision policy.Decision, filteredCount int) map[string]interface{} {
	return map[string]interface{}{"policyDecision": decision.ReasonCode, "matchedGrantIds": decision.MatchedGrantIDs, "filteredCount": filteredCount, "requiresApproval": decision.RequiresApproval, "requiresStepUp": decision.RequiresStepUp}
}

func policyErrorData(decision policy.Decision, server db.MCPServer, toolName string) map[string]interface{} {
	return map[string]interface{}{"code": decision.ReasonCode, "effect": string(decision.Effect), "serverId": server.ID, "serverSlug": server.Slug, "toolName": toolName, "matchedGrantIds": decision.MatchedGrantIDs, "requiresApproval": decision.RequiresApproval, "requiresStepUp": decision.RequiresStepUp}
}

func mergeMetadata(base map[string]interface{}, extra map[string]interface{}) map[string]interface{} {
	if base == nil {
		base = map[string]interface{}{}
	}
	for key, value := range extra {
		base[key] = value
	}
	return base
}

func errorString(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

type HTTPUpstream struct{ Timeout time.Duration }

func (u HTTPUpstream) Call(ctx context.Context, server db.MCPServer, request mcp.Request, traceID string) (mcp.Response, int, error) {
	if server.UpstreamURL == "" {
		return localCall(server, request), 200, nil
	}
	if err := validateUpstreamURL(server.UpstreamURL); err != nil {
		return mcp.Response{}, 0, err
	}
	encoded, _ := json.Marshal(request)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, server.UpstreamURL, bytes.NewReader(encoded))
	if err != nil {
		return mcp.Response{}, 0, err
	}
	req.Header.Set("content-type", "application/json")
	telemetry.InjectHeaders(ctx, req.Header)
	req.Header.Set("x-trace-id", traceID)
	client := &http.Client{Timeout: u.Timeout, Transport: secureUpstreamTransport(), CheckRedirect: func(req *http.Request, via []*http.Request) error {
		if len(via) >= 5 {
			return errors.New("UPSTREAM_REDIRECT_LIMIT")
		}
		return validateUpstreamURL(req.URL.String())
	}}
	resp, err := client.Do(req)
	if err != nil {
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return mcp.Response{}, 0, errors.New("UPSTREAM_TIMEOUT")
		}
		return mcp.Response{}, 0, errors.New("UPSTREAM_ERROR")
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return mcp.Response{}, resp.StatusCode, fmt.Errorf("UPSTREAM_HTTP_%d", resp.StatusCode)
	}
	var out mcp.Response
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return mcp.Response{}, resp.StatusCode, errors.New("UPSTREAM_INVALID_JSON_RPC_RESPONSE")
	}
	return out, resp.StatusCode, nil
}

func localCall(server db.MCPServer, request mcp.Request) mcp.Response {
	if request.Method == "initialize" {
		return mcp.Result(request.ID, map[string]interface{}{"protocolVersion": "2025-03-26", "capabilities": map[string]interface{}{"tools": map[string]interface{}{}, "resources": map[string]interface{}{}, "prompts": map[string]interface{}{}}, "serverInfo": map[string]interface{}{"name": server.Slug, "version": "0.1.0"}})
	}
	if request.Method == "ping" {
		return mcp.Result(request.ID, map[string]interface{}{})
	}
	if request.Method == "tools/call" {
		return mcp.Result(request.ID, map[string]interface{}{"content": []interface{}{map[string]interface{}{"type": "text", "text": "local tool call completed"}}})
	}
	return mcp.Result(request.ID, map[string]interface{}{"ok": true})
}

type SessionManager struct {
	mu      sync.Mutex
	idle    time.Duration
	entries map[string]Session
}

type Session struct {
	ID          string
	UserID      string
	ClientID    string
	ProjectID   string
	ServerID    string
	ServerSlug  string
	Roots       interface{}
	Initialized bool
	LastSeenAt  time.Time
	ExpiresAt   time.Time
}

type SessionResolution struct {
	ID        string
	ErrorCode string
	Message   string
}

func NewSessionManager(idle time.Duration) *SessionManager {
	if idle <= 0 {
		idle = 5 * time.Minute
	}
	return &SessionManager{idle: idle, entries: map[string]Session{}}
}

func (m *SessionManager) Resolve(r *http.Request, request mcp.Request, principal db.AuthContext, server db.MCPServer) SessionResolution {
	m.mu.Lock()
	defer m.mu.Unlock()
	now := time.Now().UTC()
	m.sweepLocked(now)
	if request.Method == "initialize" {
		id := db.NewID()
		m.entries[id] = Session{ID: id, UserID: principal.UserID, ClientID: principal.ClientID, ProjectID: principal.ProjectID, ServerID: server.ID, ServerSlug: server.Slug, Roots: request.Params["roots"], LastSeenAt: now, ExpiresAt: now.Add(m.idle)}
		return SessionResolution{ID: id}
	}
	id := sessionIDFromRequest(r)
	if id == "" {
		return SessionResolution{}
	}
	session, ok := m.entries[id]
	if !ok || now.After(session.ExpiresAt) {
		delete(m.entries, id)
		return SessionResolution{ID: id, ErrorCode: "MCP_SESSION_EXPIRED", Message: "MCP session is expired or unknown."}
	}
	if session.UserID != principal.UserID || session.ClientID != principal.ClientID || session.ProjectID != principal.ProjectID || session.ServerID != server.ID {
		return SessionResolution{ID: id, ErrorCode: "MCP_SESSION_PRINCIPAL_MISMATCH", Message: "MCP session does not belong to this principal or server."}
	}
	session.LastSeenAt = now
	session.ExpiresAt = now.Add(m.idle)
	m.entries[id] = session
	return SessionResolution{ID: id}
}

func (m *SessionManager) MarkInitialized(id string) {
	if id == "" {
		return
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	session, ok := m.entries[id]
	if !ok {
		return
	}
	session.Initialized = true
	session.LastSeenAt = time.Now().UTC()
	session.ExpiresAt = session.LastSeenAt.Add(m.idle)
	m.entries[id] = session
}

func (m *SessionManager) Active() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.sweepLocked(time.Now().UTC())
	return len(m.entries)
}

func (m *SessionManager) sweepLocked(now time.Time) {
	for id, session := range m.entries {
		if now.After(session.ExpiresAt) {
			delete(m.entries, id)
		}
	}
}

func sessionIDFromRequest(r *http.Request) string {
	if value := strings.TrimSpace(r.Header.Get("mcp-session-id")); value != "" {
		return value
	}
	return strings.TrimSpace(r.Header.Get("x-mcp-session-id"))
}

type StepUpTokens struct {
	mu     sync.Mutex
	ttl    time.Duration
	tokens map[string]StepUpToken
}

type StepUpToken struct {
	UserID    string
	ClientID  string
	ProjectID string
	ServerID  string
	ToolName  string
	ExpiresAt time.Time
}

func NewStepUpTokens(ttl time.Duration) *StepUpTokens {
	if ttl <= 0 {
		ttl = 5 * time.Minute
	}
	return &StepUpTokens{ttl: ttl, tokens: map[string]StepUpToken{}}
}

func (s *StepUpTokens) Issue(principal db.AuthContext, serverID string, toolName string) string {
	s.mu.Lock()
	defer s.mu.Unlock()
	token := db.NewID()
	s.tokens[token] = StepUpToken{UserID: principal.UserID, ClientID: principal.ClientID, ProjectID: principal.ProjectID, ServerID: serverID, ToolName: toolName, ExpiresAt: time.Now().UTC().Add(s.ttl)}
	return token
}

func (s *StepUpTokens) Consume(token string, principal db.AuthContext, serverID string, toolName string) bool {
	if strings.TrimSpace(token) == "" {
		return false
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	entry, ok := s.tokens[token]
	delete(s.tokens, token)
	if !ok || time.Now().UTC().After(entry.ExpiresAt) {
		return false
	}
	return entry.UserID == principal.UserID && entry.ClientID == principal.ClientID && entry.ProjectID == principal.ProjectID && entry.ServerID == serverID && entry.ToolName == toolName
}

type GatewayMetrics struct {
	mu                         sync.Mutex
	requests                   int
	filteredTools              int
	rateLimited                int
	reloadSuccesses            int
	reloadFailures             int
	upstreamLatencyMillisTotal int
	lastReloadReason           string
	lastReloadError            string
}

func NewGatewayMetrics() *GatewayMetrics { return &GatewayMetrics{} }

func (m *GatewayMetrics) RecordRequest() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.requests++
}
func (m *GatewayMetrics) RecordDiscoveryFiltered(count int) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.filteredTools += count
}
func (m *GatewayMetrics) RecordRateLimited() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.rateLimited++
}
func (m *GatewayMetrics) RecordReloadSuccess(reason string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.reloadSuccesses++
	m.lastReloadReason = reason
	m.lastReloadError = ""
}
func (m *GatewayMetrics) RecordReloadFailure(err error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.reloadFailures++
	m.lastReloadError = err.Error()
}
func (m *GatewayMetrics) RecordUpstreamLatency(duration time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.upstreamLatencyMillisTotal += int(duration.Milliseconds())
}
func (m *GatewayMetrics) Render(activeSessions int) string {
	m.mu.Lock()
	defer m.mu.Unlock()
	return fmt.Sprintf("mcp_gateway_request_total %d\nmcp_gateway_tool_discovery_filtered_total %d\nmcp_gateway_rate_limited_total %d\nmcp_gateway_reload_success_total %d\nmcp_gateway_reload_failure_total %d\nmcp_gateway_upstream_latency_ms_sum %d\nmcp_gateway_sessions_active %d\nmcp_gateway_last_reload_info{reason=%q,error=%q} 1\n", m.requests, m.filteredTools, m.rateLimited, m.reloadSuccesses, m.reloadFailures, m.upstreamLatencyMillisTotal, activeSessions, m.lastReloadReason, m.lastReloadError)
}

type CircuitBreaker struct {
	mu        sync.Mutex
	threshold int
	openFor   time.Duration
	failures  map[string]int
	openedAt  map[string]time.Time
}

func NewCircuitBreaker(threshold int, openFor time.Duration) *CircuitBreaker {
	if threshold <= 0 {
		threshold = 3
	}
	if openFor <= 0 {
		openFor = 30 * time.Second
	}
	return &CircuitBreaker{threshold: threshold, openFor: openFor, failures: map[string]int{}, openedAt: map[string]time.Time{}}
}
func (c *CircuitBreaker) State(slug string) string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.stateLocked(slug, time.Now().UTC())
}
func (c *CircuitBreaker) RecordSuccess(slug string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.failures[slug] = 0
	delete(c.openedAt, slug)
}
func (c *CircuitBreaker) RecordFailure(slug string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.failures[slug]++
	if c.failures[slug] >= c.threshold {
		c.openedAt[slug] = time.Now().UTC()
	}
}
func (c *CircuitBreaker) stateLocked(slug string, now time.Time) string {
	if c.failures[slug] < c.threshold {
		return "closed"
	}
	opened := c.openedAt[slug]
	if opened.IsZero() || now.Sub(opened) < c.openFor {
		return "open"
	}
	return "half_open"
}

func validateUpstreamURL(raw string) error {
	if raw == "" {
		return nil
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return errors.New("UPSTREAM_URL_INVALID")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return errors.New("UPSTREAM_URL_BLOCKED")
	}
	host := parsed.Hostname()
	if strings.EqualFold(host, "metadata.google.internal") {
		return errors.New("UPSTREAM_URL_BLOCKED")
	}
	if _, err := safeUpstreamIPs(host); err != nil {
		return err
	}
	return nil
}

func secureUpstreamTransport() http.RoundTripper {
	dialer := net.Dialer{Timeout: 5 * time.Second, KeepAlive: 30 * time.Second}
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.Proxy = nil
	transport.DialContext = func(ctx context.Context, network, address string) (net.Conn, error) {
		host, port, err := net.SplitHostPort(address)
		if err != nil {
			return nil, errors.New("UPSTREAM_URL_INVALID")
		}
		ips, err := safeUpstreamIPs(host)
		if err != nil {
			return nil, err
		}
		var lastErr error
		for _, ip := range ips {
			conn, err := dialer.DialContext(ctx, network, net.JoinHostPort(ip.String(), port))
			if err == nil {
				return conn, nil
			}
			lastErr = err
		}
		if lastErr != nil {
			return nil, lastErr
		}
		return nil, errors.New("UPSTREAM_DNS_EMPTY")
	}
	return transport
}

func safeUpstreamIPs(host string) ([]net.IP, error) {
	if strings.TrimSpace(host) == "" {
		return nil, errors.New("UPSTREAM_URL_INVALID")
	}
	if strings.EqualFold(host, "localhost") {
		return []net.IP{net.ParseIP("127.0.0.1")}, nil
	}
	if ip := net.ParseIP(host); ip != nil {
		if blockedUpstreamIP(ip, true) {
			return nil, errors.New("UPSTREAM_URL_BLOCKED")
		}
		return []net.IP{ip}, nil
	}
	ips, err := net.LookupIP(host)
	if err != nil || len(ips) == 0 {
		return nil, errors.New("UPSTREAM_DNS_FAILED")
	}
	for _, ip := range ips {
		if blockedUpstreamIP(ip, false) {
			return nil, errors.New("UPSTREAM_URL_BLOCKED")
		}
	}
	return ips, nil
}

func blockedUpstreamIP(ip net.IP, allowLoopback bool) bool {
	if ip.IsLoopback() && allowLoopback {
		return false
	}
	return ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsMulticast() || ip.IsUnspecified()
}

func pathParts(path, prefix string) []string {
	if path == prefix || !strings.HasPrefix(path, prefix+"/") {
		return nil
	}
	rest := strings.TrimPrefix(path, prefix+"/")
	if rest == "" || strings.Contains(rest, "/") {
		return nil
	}
	return strings.Split(rest, "/")
}
func toolName(request mcp.Request) string {
	if request.Params == nil {
		return ""
	}
	if value, ok := request.Params["name"].(string); ok {
		return value
	}
	return ""
}
func args(request mcp.Request) interface{} {
	if request.Params == nil {
		return nil
	}
	return request.Params["arguments"]
}
func findTool(tools []db.MCPTool, name string) (db.MCPTool, bool) {
	for _, tool := range tools {
		if tool.Name == name {
			return tool, true
		}
	}
	return db.MCPTool{}, false
}
func riskFor(tool db.MCPTool, server db.MCPServer) db.RiskLevel {
	if tool.RiskLevel != "" {
		return tool.RiskLevel
	}
	return server.RiskLevel
}
func contains(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}
func supported(method string) bool {
	switch method {
	case "initialize", "ping", "tools/call", "resources/list", "resources/read", "prompts/list", "prompts/get":
		return true
	default:
		return false
	}
}
func upstreamTimeout(server db.MCPServer, cfg config.Config) time.Duration {
	if server.TimeoutMS > 0 {
		return time.Duration(server.TimeoutMS) * time.Millisecond
	}
	return time.Duration(cfg.UpstreamTimeoutSeconds()) * time.Second
}
func ListenAndServe(store *db.Store, cfg config.Config) error {
	shutdown, err := telemetry.Init(context.Background(), "gateway")
	if err != nil {
		return err
	}
	defer shutdown(context.Background())
	address := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	server := NewServer(store, cfg, nil)
	server.startSignalReload()
	return http.ListenAndServe(address, server.Handler())
}

func (s *Server) startSignalReload() {
	ch := make(chan os.Signal, 1)
	signal.Notify(ch, syscall.SIGHUP)
	go func() {
		for range ch {
			if err := s.reloadRegistry("sighup"); err != nil {
				s.log.Error("gateway.reload.failed", map[string]interface{}{"error": err.Error()})
			}
		}
	}()
}
