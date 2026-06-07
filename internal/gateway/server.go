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
	"strings"
	"sync"
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
)

type Upstream interface {
	Call(ctx context.Context, server db.MCPServer, request mcp.Request, traceID string) (mcp.Response, int, error)
}

type Server struct {
	store    *db.Store
	cfg      config.Config
	log      logger.Logger
	upstream Upstream
	breaker  *CircuitBreaker
	limiter  *ratelimit.Limiter
}

func NewServer(store *db.Store, cfg config.Config, upstream Upstream) *Server {
	if store == nil {
		store = db.NewSeedStore()
	}
	if upstream == nil {
		upstream = HTTPUpstream{Timeout: 2 * time.Second}
	}
	return &Server{store: store, cfg: cfg, log: logger.New("gateway"), upstream: upstream, breaker: NewCircuitBreaker(3), limiter: ratelimit.New(1000)}
}
func (s *Server) Handler() http.Handler { return http.HandlerFunc(s.handle) }

func (s *Server) handle(w http.ResponseWriter, r *http.Request) {
	s.store.Refresh()
	defer s.store.Save()
	traceID := auth.TraceID(r)
	w.Header().Set("x-trace-id", traceID)
	started := time.Now()
	if r.URL.Path == "/healthz" && r.Method == http.MethodGet {
		httpx.WriteJSON(w, 200, map[string]string{"service": "gateway", "status": "ok"})
		return
	}
	if r.URL.Path == "/readyz" && r.Method == http.MethodGet {
		httpx.WriteJSON(w, 200, map[string]interface{}{"service": "gateway", "status": "ready", "dependencies": map[string]string{"store": "ready"}})
		return
	}
	if r.URL.Path == "/metrics" && r.Method == http.MethodGet {
		httpx.WriteText(w, 200, "text/plain; version=0.0.4", "mcp_gateway_request_info{service=\"gateway\"} 1\n")
		return
	}

	parts := pathParts(r.URL.Path, "/mcp")
	if len(parts) != 1 {
		s.record(traceID, db.AuthContext{}, "server.connect.denied", "", "", db.RiskLow, db.PolicyDeny, "GATEWAY_ROUTE_NOT_FOUND", started, nil)
		httpx.WriteJSON(w, 404, map[string]string{"error": "not_found"})
		return
	}
	principal, ok := auth.PrincipalFromBearer(r)
	if !ok {
		s.record(traceID, db.AuthContext{}, "auth.failure", "", "", db.RiskLow, db.PolicyDeny, "AUTH_MISSING_OR_INVALID_BEARER_TOKEN", started, nil)
		httpx.WriteJSON(w, 401, map[string]string{"error": "missing_or_invalid_bearer_token"})
		return
	}
	if !s.limiter.Allow(principal.UserID) {
		s.record(traceID, principal, "server.connect.denied", "", "", db.RiskLow, db.PolicyDeny, "RATE_LIMITED", started, nil)
		httpx.WriteJSON(w, 429, map[string]string{"error": "rate_limited"})
		return
	}

	server, tools, grants, err := s.store.FindServerBySlug(parts[0])
	if err != nil {
		s.record(traceID, principal, "server.connect.denied", "", "", db.RiskLow, db.PolicyDeny, "MCP_SERVER_NOT_FOUND", started, nil)
		httpx.WriteJSON(w, 404, map[string]string{"error": "mcp_server_not_found"})
		return
	}
	emergency := emergencyFor(s.store.SnapshotGatewayRegistry(), server.ID)
	connectDecision := policy.EvaluateConnect(principal, server, grants, emergency)
	if !connectDecision.Allowed {
		s.record(traceID, principal, "server.connect.denied", server.ID, "", server.RiskLevel, connectDecision.Effect, connectDecision.ReasonCode, started, nil)
		httpx.WriteJSON(w, 403, map[string]interface{}{"error": "mcp_server_denied", "reason": connectDecision.Reason})
		return
	}
	s.record(traceID, principal, "server.connect.allowed", server.ID, "", server.RiskLevel, db.PolicyAllow, "", started, nil)

	if r.Method == http.MethodGet {
		httpx.WriteJSON(w, 200, map[string]interface{}{"server": map[string]interface{}{"id": server.ID, "slug": server.Slug, "transport": server.Transport}, "circuitState": s.breaker.State(server.Slug)})
		return
	}
	if r.Method != http.MethodPost {
		s.record(traceID, principal, "server.connect.denied", server.ID, "", server.RiskLevel, db.PolicyDeny, "METHOD_NOT_ALLOWED", started, nil)
		httpx.WriteJSON(w, 405, map[string]string{"error": "method_not_allowed"})
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
	status, response := s.handleMCP(r.Context(), request, principal, server, tools, grants, emergency, traceID, started)
	httpx.WriteJSON(w, status, response)
}

func (s *Server) handleMCP(ctx context.Context, request mcp.Request, principal db.AuthContext, server db.MCPServer, tools []db.MCPTool, grants []db.Grant, emergency *db.EmergencyDeny, traceID string, started time.Time) (int, mcp.Response) {
	if request.Method == "notifications/initialized" {
		s.record(traceID, principal, "server.connect.allowed", server.ID, "", server.RiskLevel, db.PolicyAllow, "", started, nil)
		return 202, mcp.Result(request.ID, map[string]interface{}{"accepted": true})
	}
	if request.Method == "tools/list" {
		decision := policy.EvaluateDiscovery(principal, server, tools, grants, emergency)
		if !decision.Allowed {
			s.record(traceID, principal, "tool.discovery.filtered", server.ID, "", server.RiskLevel, decision.Effect, decision.ReasonCode, started, nil)
			return 200, mcp.Error(request.ID, -32001, decision.Reason)
		}
		allowed := make([]map[string]interface{}, 0, len(decision.DiscoverableToolNames))
		for _, tool := range tools {
			if contains(decision.DiscoverableToolNames, tool.Name) {
				allowed = append(allowed, map[string]interface{}{"name": tool.Name, "description": tool.Description, "inputSchema": tool.InputSchema})
			}
		}
		eventType := "tool.discovery.allowed"
		if len(allowed) < len(tools) {
			eventType = "tool.discovery.filtered"
		}
		s.record(traceID, principal, eventType, server.ID, "", server.RiskLevel, db.PolicyAllow, "", started, nil)
		return 200, mcp.Result(request.ID, map[string]interface{}{"tools": allowed})
	}
	toolName := toolName(request)
	tool, foundTool := findTool(tools, toolName)
	if request.Method == "tools/call" {
		decision := policy.EvaluateToolCall(principal, server, tool, grants, emergency, false)
		redactedArgs := redaction.Redact(args(request))
		if !foundTool || !decision.Allowed {
			s.record(traceID, principal, "tool.call.denied", server.ID, toolName, riskFor(tool, server), decision.Effect, decision.ReasonCode, started, redactedArgs)
			return 200, mcp.Error(request.ID, -32001, decision.Reason)
		}
		s.record(traceID, principal, "tool.call.allowed", server.ID, toolName, tool.RiskLevel, db.PolicyAllow, "", started, redactedArgs)
	}
	if !supported(request.Method) {
		s.record(traceID, principal, "server.connect.denied", server.ID, toolName, riskFor(tool, server), db.PolicyDeny, "MCP_METHOD_UNSUPPORTED", started, args(request))
		return 200, mcp.Error(request.ID, -32601, "Unsupported MCP method "+request.Method)
	}
	if s.breaker.State(server.Slug) == "degraded" {
		s.record(traceID, principal, "tool.call.failed", server.ID, toolName, riskFor(tool, server), db.PolicyDeny, "UPSTREAM_DEGRADED", started, args(request))
		return 503, mcp.Error(request.ID, -32002, "Upstream is degraded")
	}
	if err := validateUpstreamURL(server.UpstreamURL); err != nil {
		s.record(traceID, principal, "tool.call.failed", server.ID, toolName, riskFor(tool, server), db.PolicyDeny, "UPSTREAM_URL_BLOCKED", started, args(request))
		return 502, mcp.Error(request.ID, -32003, err.Error())
	}
	callCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	response, upstreamStatus, err := s.upstream.Call(callCtx, server, request, traceID)
	if err != nil {
		s.breaker.RecordFailure(server.Slug)
		s.record(traceID, principal, "tool.call.failed", server.ID, toolName, riskFor(tool, server), db.PolicyDeny, err.Error(), started, args(request))
		return 502, mcp.Error(request.ID, -32003, err.Error())
	}
	s.breaker.RecordSuccess(server.Slug)
	eventType := "server.connect.allowed"
	if request.Method == "tools/call" {
		eventType = "tool.call.succeeded"
	}
	event := audit.NewEvent(eventType, principal, traceID, server.ID, toolName, riskFor(tool, server), db.PolicyAllow)
	event.LatencyMS = int(time.Since(started).Milliseconds())
	event.UpstreamStatus = upstreamStatus
	event.ArgumentRedactedJSON = redaction.Redact(args(request))
	event.ArgumentHash = redaction.Hash(args(request))
	s.store.AddAudit(event)
	return 200, response
}

func (s *Server) record(traceID string, principal db.AuthContext, eventType, serverID, toolName string, risk db.RiskLevel, decision db.PolicyEffect, errorCode string, started time.Time, argument interface{}) {
	event := audit.NewEvent(eventType, principal, traceID, serverID, toolName, risk, decision)
	event.LatencyMS = int(time.Since(started).Milliseconds())
	event.ErrorCode = errorCode
	event.ArgumentRedactedJSON = redaction.Redact(argument)
	if argument != nil {
		event.ArgumentHash = redaction.Hash(argument)
	}
	s.store.AddAudit(event)
}

type HTTPUpstream struct{ Timeout time.Duration }

func (u HTTPUpstream) Call(ctx context.Context, server db.MCPServer, request mcp.Request, traceID string) (mcp.Response, int, error) {
	if server.UpstreamURL == "" {
		return localCall(server, request), 200, nil
	}
	encoded, _ := json.Marshal(request)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, server.UpstreamURL, bytes.NewReader(encoded))
	if err != nil {
		return mcp.Response{}, 0, err
	}
	req.Header.Set("content-type", "application/json")
	req.Header.Set("x-trace-id", traceID)
	client := &http.Client{Timeout: u.Timeout}
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
		return mcp.Result(request.ID, map[string]interface{}{"content": []interface{}{map[string]interface{}{"type": "text", "text": string(mustJSON(args(request)))}}})
	}
	return mcp.Result(request.ID, map[string]interface{}{"ok": true})
}

type CircuitBreaker struct {
	mu        sync.Mutex
	threshold int
	failures  map[string]int
}

func NewCircuitBreaker(threshold int) *CircuitBreaker {
	return &CircuitBreaker{threshold: threshold, failures: map[string]int{}}
}
func (c *CircuitBreaker) State(slug string) string {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.failures[slug] >= c.threshold {
		return "degraded"
	}
	return "closed"
}
func (c *CircuitBreaker) RecordSuccess(slug string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.failures[slug] = 0
}
func (c *CircuitBreaker) RecordFailure(slug string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.failures[slug]++
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
	if host == "localhost" || host == "127.0.0.1" || host == "::1" {
		return nil
	}
	if ip := net.ParseIP(host); ip != nil {
		if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() {
			return errors.New("UPSTREAM_URL_BLOCKED")
		}
	}
	if strings.EqualFold(host, "metadata.google.internal") {
		return errors.New("UPSTREAM_URL_BLOCKED")
	}
	return nil
}

func pathParts(path, prefix string) []string {
	rest := strings.Trim(strings.TrimPrefix(path, prefix), "/")
	if rest == "" {
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
func mustJSON(value interface{}) []byte { encoded, _ := json.Marshal(value); return encoded }
func emergencyFor(snapshots []db.GatewayServerSnapshot, serverID string) *db.EmergencyDeny {
	for _, snapshot := range snapshots {
		if snapshot.Server.ID == serverID {
			return snapshot.EmergencyDeny
		}
	}
	return nil
}

func ListenAndServe(store *db.Store, cfg config.Config) error {
	address := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	return http.ListenAndServe(address, NewServer(store, cfg, nil).Handler())
}
