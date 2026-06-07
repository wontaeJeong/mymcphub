package db

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

const (
	AdminUserID     = "00000000-0000-4000-8000-000000000001"
	PlatformTeamID  = "00000000-0000-4000-8000-000000000010"
	SampleProjectID = "00000000-0000-4000-8000-000000000020"
	K8sReadonlyID   = "00000000-0000-4000-8000-000000000102"
	SampleGrantID   = "00000000-0000-4000-8000-000000000200"
)

var (
	ErrNotFound     = errors.New("not found")
	ErrUnauthorized = errors.New("unauthorized")
	ErrValidation   = errors.New("validation failed")
)

type Store struct {
	mu             sync.RWMutex
	persistPath    string
	servers        []MCPServer
	tools          []MCPTool
	versions       []MCPServerVersion
	grants         []Grant
	approvals      []Approval
	auditEvents    []AuditEvent
	toolCallEvents []ToolCallEvent
	health         []ServerHealth
	emergencyDeny  *EmergencyDeny
}

type snapshot struct {
	Servers        []MCPServer        `json:"servers"`
	Tools          []MCPTool          `json:"tools"`
	Versions       []MCPServerVersion `json:"versions"`
	Grants         []Grant            `json:"grants"`
	Approvals      []Approval         `json:"approvals"`
	AuditEvents    []AuditEvent       `json:"auditEvents"`
	ToolCallEvents []ToolCallEvent    `json:"toolCallEvents"`
	Health         []ServerHealth     `json:"health"`
	EmergencyDeny  *EmergencyDeny     `json:"emergencyDeny,omitempty"`
}

func NewSeedStore() *Store {
	now := Now()
	store := &Store{
		servers: []MCPServer{
			seedServer(K8sReadonlyID, "k8s-readonly", "Kubernetes Readonly MCP Server", "Read-only Kubernetes MCP server with local mock mode.", TransportStreamableHTTP, RiskMedium, "http://localhost:5102/mcp", now),
		},
		versions: []MCPServerVersion{
			seedVersion(K8sReadonlyID, now),
		},
		tools: []MCPTool{
			seedTool(K8sReadonlyID, "list_namespaces", "List namespace names from the local read-only mock Kubernetes dataset.", RiskMedium, emptySchema(), now),
			seedTool(K8sReadonlyID, "list_pods", "List pods in one namespace from the local read-only mock Kubernetes dataset.", RiskMedium, map[string]interface{}{"type": "object", "properties": map[string]interface{}{"namespace": map[string]interface{}{"type": "string"}}, "required": []interface{}{"namespace"}, "additionalProperties": false}, now),
			seedTool(K8sReadonlyID, "get_pod", "Read one pod by namespace and name from the local read-only mock Kubernetes dataset.", RiskMedium, map[string]interface{}{"type": "object", "properties": map[string]interface{}{"namespace": map[string]interface{}{"type": "string"}, "podName": map[string]interface{}{"type": "string"}}, "required": []interface{}{"namespace", "podName"}, "additionalProperties": false}, now),
		},
		grants: []Grant{
			{ID: SampleGrantID, SubjectType: SubjectTeam, SubjectID: PlatformTeamID, ProjectID: SampleProjectID, ServerID: K8sReadonlyID, AllowedTools: []string{"list_namespaces", "list_pods", "get_pod"}, Environment: EnvironmentDev, ApprovedBy: AdminUserID, Reason: "Initial sample grant for local development.", Enabled: true, CreatedAt: now},
		},
		auditEvents:    []AuditEvent{{ID: NewID(), Timestamp: now, UserID: AdminUserID, TeamID: PlatformTeamID, ProjectID: SampleProjectID, ClientID: "local-dev-client", ServerID: K8sReadonlyID, ToolName: "list_namespaces", EventType: "seed.audit_event", RiskLevel: RiskMedium, PolicyDecision: PolicyAllow, TraceID: "seed-trace", MetadataJSON: map[string]interface{}{"source": "seed"}}},
		toolCallEvents: []ToolCallEvent{{ID: NewID(), AuditEventID: "seed-audit-event", ServerID: K8sReadonlyID, ToolName: "list_namespaces", Status: "ok", LatencyMS: 12, CreatedAt: now}},
		health:         []ServerHealth{{ID: NewID(), ServerID: K8sReadonlyID, Status: "healthy", LatencyMS: 10, CheckedAt: now}},
	}
	return store
}

func NewRuntimeStore() *Store {
	store := NewSeedStore()
	if os.Getenv("MCP_STORE_MODE") == "memory" {
		return store
	}
	path := strings.TrimSpace(os.Getenv("MCP_STORE_PATH"))
	if path == "" {
		path = filepath.Join(os.TempDir(), "mcp-hub", "store.json")
	}
	store.UsePersistence(path)
	return store
}

func (s *Store) UsePersistence(path string) {
	if strings.TrimSpace(path) == "" {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.persistPath = path
	if err := s.loadLocked(); errors.Is(err, os.ErrNotExist) {
		_ = s.saveLocked()
	}
}

func (s *Store) Refresh() {
	s.mu.Lock()
	defer s.mu.Unlock()
	_ = s.loadLocked()
}

func (s *Store) Save() {
	s.mu.Lock()
	defer s.mu.Unlock()
	_ = s.saveLocked()
}

func (s *Store) loadLocked() error {
	if s.persistPath == "" {
		return nil
	}
	data, err := os.ReadFile(s.persistPath)
	if err != nil {
		return err
	}
	if len(strings.TrimSpace(string(data))) == 0 {
		return nil
	}
	var state snapshot
	if err := json.Unmarshal(data, &state); err != nil {
		return err
	}
	s.servers = cloneSlice(state.Servers)
	s.tools = cloneSlice(state.Tools)
	s.versions = cloneSlice(state.Versions)
	s.grants = cloneSlice(state.Grants)
	s.approvals = cloneSlice(state.Approvals)
	s.auditEvents = cloneSlice(state.AuditEvents)
	s.toolCallEvents = cloneSlice(state.ToolCallEvents)
	s.health = cloneSlice(state.Health)
	s.emergencyDeny = state.EmergencyDeny
	return nil
}

func (s *Store) saveLocked() error {
	if s.persistPath == "" {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(s.persistPath), 0o700); err != nil {
		return err
	}
	state := snapshot{Servers: s.servers, Tools: s.tools, Versions: s.versions, Grants: s.grants, Approvals: s.approvals, AuditEvents: s.auditEvents, ToolCallEvents: s.toolCallEvents, Health: s.health, EmergencyDeny: s.emergencyDeny}
	encoded, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.persistPath + "." + NewID() + ".tmp"
	if err := os.WriteFile(tmp, encoded, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, s.persistPath)
}

func (s *Store) ListServers() ListResponse[MCPServer] {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return ListResponse[MCPServer]{Items: cloneSlice(s.servers)}
}

func (s *Store) CreateServer(input MCPServer, tools []MCPTool, auth AuthContext, traceID string, argument interface{}) (MCPServer, error) {
	if strings.TrimSpace(input.Slug) == "" || strings.TrimSpace(input.DisplayName) == "" || strings.TrimSpace(input.OwnerTeamID) == "" {
		return MCPServer{}, fmt.Errorf("%w: slug, displayName, and ownerTeamId are required", ErrValidation)
	}
	now := Now()
	input.ID = NewID()
	input.CreatedAt = now
	input.UpdatedAt = now
	if input.Environment == "" {
		input.Environment = EnvironmentDev
	}
	if input.Transport == "" {
		input.Transport = TransportStreamableHTTP
	}
	if input.RiskLevel == "" {
		input.RiskLevel = RiskLow
	}
	input.Published = input.Enabled
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, server := range s.servers {
		if server.Slug == input.Slug {
			return MCPServer{}, fmt.Errorf("%w: server slug already exists", ErrValidation)
		}
	}
	s.servers = append(s.servers, input)
	for _, tool := range tools {
		tool.ID = NewID()
		tool.ServerID = input.ID
		tool.DiscoveredAt = now
		tool.LastSeenAt = now
		if tool.RiskLevel == "" {
			tool.RiskLevel = RiskLow
		}
		s.tools = append(s.tools, tool)
	}
	s.recordAuditLocked(auth, traceID, "mcp_server.created", input.ID, "", PolicyAllow, input.RiskLevel, argument)
	return input, nil
}

func (s *Store) GetServer(id string) (MCPServer, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.getServerLocked(id)
}

func (s *Store) FindServerBySlug(slug string) (MCPServer, []MCPTool, []Grant, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, server := range s.servers {
		if server.Slug == slug {
			return server, s.toolsForServerLocked(server.ID), s.grantsForServerLocked(server.ID), nil
		}
	}
	return MCPServer{}, nil, nil, ErrNotFound
}

func (s *Store) PatchServer(id string, patch map[string]interface{}, auth AuthContext, traceID string) (MCPServer, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	idx := s.serverIndexLocked(id)
	if idx < 0 {
		return MCPServer{}, ErrNotFound
	}
	if v, ok := patch["displayName"].(string); ok {
		s.servers[idx].DisplayName = v
	}
	if v, ok := patch["description"].(string); ok {
		s.servers[idx].Description = v
	}
	if v, ok := patch["enabled"].(bool); ok {
		s.servers[idx].Enabled = v
	}
	s.servers[idx].UpdatedAt = Now()
	s.recordAuditLocked(auth, traceID, "mcp_server.updated", id, "", PolicyAllow, s.servers[idx].RiskLevel, patch)
	return s.servers[idx], nil
}

func (s *Store) SetServerState(id string, action string, auth AuthContext, traceID string) (MCPServer, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	idx := s.serverIndexLocked(id)
	if idx < 0 {
		return MCPServer{}, ErrNotFound
	}
	server := &s.servers[idx]
	switch action {
	case "enable", "publish":
		server.Enabled = true
		server.Published = true
		server.Quarantined = false
	case "disable", "unpublish":
		server.Enabled = false
		server.Published = false
	case "quarantine":
		server.Enabled = false
		server.Quarantined = true
	default:
		return MCPServer{}, fmt.Errorf("%w: unsupported server action", ErrValidation)
	}
	server.UpdatedAt = Now()
	s.recordAuditLocked(auth, traceID, "mcp_server."+action, id, "", PolicyAllow, server.RiskLevel, nil)
	return *server, nil
}

func (s *Store) ListTools(serverID string) (ListResponse[MCPTool], error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if _, err := s.getServerLocked(serverID); err != nil {
		return ListResponse[MCPTool]{}, err
	}
	return ListResponse[MCPTool]{Items: s.toolsForServerLocked(serverID)}, nil
}

func (s *Store) PatchTool(serverID, toolID string, patch map[string]interface{}, auth AuthContext, traceID string) (MCPTool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, err := s.getServerLocked(serverID); err != nil {
		return MCPTool{}, err
	}
	idx := s.toolIndexLocked(toolID)
	if idx < 0 {
		return MCPTool{}, ErrNotFound
	}
	if v, ok := patch["description"].(string); ok {
		s.tools[idx].Description = v
	}
	if v, ok := patch["enabled"].(bool); ok {
		s.tools[idx].Enabled = v
	}
	if v, ok := patch["riskLevel"].(string); ok {
		s.tools[idx].RiskLevel = RiskLevel(v)
	}
	s.tools[idx].LastSeenAt = Now()
	s.recordAuditLocked(auth, traceID, "mcp_tool.updated", serverID, s.tools[idx].Name, PolicyAllow, s.tools[idx].RiskLevel, patch)
	return s.tools[idx], nil
}

func (s *Store) SetToolEnabled(serverID, toolID string, enabled bool, auth AuthContext, traceID string) (MCPTool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, err := s.getServerLocked(serverID); err != nil {
		return MCPTool{}, err
	}
	idx := s.toolIndexLocked(toolID)
	if idx < 0 {
		return MCPTool{}, ErrNotFound
	}
	s.tools[idx].Enabled = enabled
	s.tools[idx].LastSeenAt = Now()
	event := "mcp_tool.enabled"
	if !enabled {
		event = "tool.disabled"
	}
	s.recordAuditLocked(auth, traceID, event, serverID, s.tools[idx].Name, PolicyAllow, s.tools[idx].RiskLevel, nil)
	return s.tools[idx], nil
}

func (s *Store) ListVersions(serverID string) (ListResponse[MCPServerVersion], error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if _, err := s.getServerLocked(serverID); err != nil {
		return ListResponse[MCPServerVersion]{}, err
	}
	var out []MCPServerVersion
	for _, v := range s.versions {
		if v.ServerID == serverID {
			out = append(out, v)
		}
	}
	return ListResponse[MCPServerVersion]{Items: out}, nil
}

func (s *Store) CreateVersion(serverID string, input MCPServerVersion, auth AuthContext, traceID string, argument interface{}) (MCPServerVersion, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, err := s.getServerLocked(serverID); err != nil {
		return MCPServerVersion{}, err
	}
	if input.Version == "" {
		return MCPServerVersion{}, fmt.Errorf("%w: version is required", ErrValidation)
	}
	now := Now()
	input.ID = NewID()
	input.ServerID = serverID
	input.CreatedAt = now
	input.UpdatedAt = now
	if input.Status == "" {
		input.Status = "draft"
	}
	if input.Status == "active" {
		input.ActivatedAt = now
		s.deactivateVersionsLocked(serverID, "deprecated", input.ID)
	}
	s.versions = append(s.versions, input)
	s.recordAuditLocked(auth, traceID, "mcp_server_version.created", serverID, "", PolicyAllow, RiskLow, argument)
	return input, nil
}

func (s *Store) ActivateVersion(serverID, versionID string, rollback bool, auth AuthContext, traceID string) (MCPServerVersion, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	idx := s.versionIndexLocked(serverID, versionID)
	if idx < 0 {
		return MCPServerVersion{}, ErrNotFound
	}
	status := "deprecated"
	event := "mcp_server_version.activated"
	if rollback {
		status = "rolled_back"
		event = "mcp_server_version.rolled_back"
	}
	s.deactivateVersionsLocked(serverID, status, versionID)
	now := Now()
	s.versions[idx].Status = "active"
	s.versions[idx].UpdatedAt = now
	s.versions[idx].ActivatedAt = now
	if rollback {
		s.versions[idx].RolledBackAt = now
	}
	s.recordAuditLocked(auth, traceID, event, serverID, "", PolicyAllow, RiskLow, map[string]interface{}{"versionId": versionID})
	return s.versions[idx], nil
}

func (s *Store) SchemaDiff(serverID string) (SchemaDiff, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if _, err := s.getServerLocked(serverID); err != nil {
		return SchemaDiff{}, err
	}
	return SchemaDiff{ServerID: serverID, Status: "placeholder", GeneratedAt: Now(), Changes: []map[string]interface{}{}}, nil
}

func (s *Store) ListGrants() ListResponse[Grant] {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return ListResponse[Grant]{Items: cloneSlice(s.grants)}
}

func (s *Store) CreateGrant(input Grant, auth AuthContext, traceID string, argument interface{}) (Grant, error) {
	if input.SubjectID == "" || input.ProjectID == "" || input.ServerID == "" || len(input.AllowedTools) == 0 || input.Reason == "" {
		return Grant{}, fmt.Errorf("%w: subjectId, projectId, serverId, allowedTools, and reason are required", ErrValidation)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, err := s.getServerLocked(input.ServerID); err != nil {
		return Grant{}, err
	}
	input.ID = NewID()
	input.CreatedAt = Now()
	if input.Environment == "" {
		input.Environment = EnvironmentDev
	}
	if input.SubjectType == "" {
		input.SubjectType = SubjectUser
	}
	if input.ApprovedBy == "" {
		input.ApprovedBy = auth.UserID
	}
	s.grants = append(s.grants, input)
	s.recordAuditLocked(auth, traceID, "grant.created", input.ServerID, "", PolicyAllow, RiskLow, argument)
	return input, nil
}

func (s *Store) PatchGrant(id string, patch map[string]interface{}, auth AuthContext, traceID string) (Grant, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	idx := s.grantIndexLocked(id)
	if idx < 0 {
		return Grant{}, ErrNotFound
	}
	if v, ok := patch["enabled"].(bool); ok {
		s.grants[idx].Enabled = v
	}
	if arr, ok := stringSlice(patch["allowedTools"]); ok {
		s.grants[idx].AllowedTools = arr
	}
	s.recordAuditLocked(auth, traceID, "mcp_grant.updated", s.grants[idx].ServerID, "", PolicyAllow, RiskLow, patch)
	return s.grants[idx], nil
}

func (s *Store) SetGrantEnabled(id string, enabled bool, auth AuthContext, traceID string) (Grant, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	idx := s.grantIndexLocked(id)
	if idx < 0 {
		return Grant{}, ErrNotFound
	}
	s.grants[idx].Enabled = enabled
	event := "grant.approved"
	if !enabled {
		event = "grant.revoked"
	}
	s.recordAuditLocked(auth, traceID, event, s.grants[idx].ServerID, "", PolicyAllow, RiskLow, nil)
	return s.grants[idx], nil
}

func (s *Store) ListApprovals() ListResponse[Approval] {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return ListResponse[Approval]{Items: cloneSlice(s.approvals)}
}

func (s *Store) CreateApproval(input Approval, auth AuthContext, traceID string, argument interface{}) (Approval, error) {
	if input.ServerID == "" || input.ProjectID == "" || input.Reason == "" || len(input.RequestedTools) == 0 {
		return Approval{}, fmt.Errorf("%w: serverId, projectId, requestedTools, and reason are required", ErrValidation)
	}
	now := Now()
	input.ID = NewID()
	input.RequesterID = auth.UserID
	if input.SubjectID == "" {
		input.SubjectID = auth.UserID
	}
	if input.SubjectType == "" {
		input.SubjectType = SubjectUser
	}
	if input.RequestedAction == "" {
		input.RequestedAction = "call_tool"
	}
	if input.Status == "" {
		input.Status = "pending"
	}
	input.CreatedAt = now
	input.UpdatedAt = now
	if input.ToolName == "" && len(input.RequestedTools) > 0 {
		input.ToolName = input.RequestedTools[0]
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, err := s.getServerLocked(input.ServerID); err != nil {
		return Approval{}, err
	}
	s.approvals = append(s.approvals, input)
	s.recordAuditLocked(auth, traceID, "approval.created", input.ServerID, input.ToolName, PolicyNeedsApproval, RiskLow, argument)
	return input, nil
}

func (s *Store) DecideApproval(id string, decision string, patch map[string]interface{}, auth AuthContext, traceID string) (Approval, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	idx := s.approvalIndexLocked(id)
	if idx < 0 {
		return Approval{}, ErrNotFound
	}
	if s.approvals[idx].Status != "pending" {
		return Approval{}, fmt.Errorf("%w: approval has already been decided", ErrValidation)
	}
	now := Now()
	s.approvals[idx].Status = decision
	s.approvals[idx].ReviewerID = auth.UserID
	s.approvals[idx].DecidedBy = auth.UserID
	s.approvals[idx].DecidedAt = now
	s.approvals[idx].UpdatedAt = now
	if v, ok := patch["reviewComment"].(string); ok {
		s.approvals[idx].ReviewComment = v
	}
	if decision == "approved" {
		allowed := s.approvals[idx].RequestedTools
		if arr, ok := stringSlice(patch["allowedTools"]); ok && len(arr) > 0 {
			allowed = arr
		}
		s.grants = append(s.grants, Grant{ID: NewID(), SubjectType: s.approvals[idx].SubjectType, SubjectID: s.approvals[idx].SubjectID, ProjectID: s.approvals[idx].ProjectID, ServerID: s.approvals[idx].ServerID, AllowedTools: allowed, Environment: s.approvals[idx].Environment, ApprovedBy: auth.UserID, Reason: s.approvals[idx].Reason, Enabled: true, CreatedAt: now})
	}
	effect := PolicyDeny
	event := "approval.rejected"
	if decision == "approved" {
		effect = PolicyAllow
		event = "approval.approved"
	}
	s.recordAuditLocked(auth, traceID, event, s.approvals[idx].ServerID, s.approvals[idx].ToolName, effect, RiskLow, patch)
	return s.approvals[idx], nil
}

func (s *Store) ListAuditEvents(limit int, cursor string, filters map[string]string) ListResponse[AuditEvent] {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	filtered := make([]AuditEvent, 0, len(s.auditEvents))
	for _, event := range s.auditEvents {
		if auditMatches(event, filters) {
			filtered = append(filtered, event)
		}
	}
	start := 0
	if cursor != "" {
		for i, event := range filtered {
			if event.ID == cursor {
				start = i + 1
				break
			}
		}
	}
	end := start + limit
	if end > len(filtered) {
		end = len(filtered)
	}
	items := cloneSlice(filtered[start:end])
	page := &PageInfo{Limit: limit}
	if end < len(filtered) && len(items) > 0 {
		page.NextCursor = items[len(items)-1].ID
	}
	return ListResponse[AuditEvent]{Items: items, PageInfo: page}
}

func (s *Store) RecordGatewayAudit(event AuditEvent) AuditEvent {
	s.mu.Lock()
	defer s.mu.Unlock()
	if event.ID == "" {
		event.ID = NewID()
	}
	if event.Timestamp == "" {
		event.Timestamp = Now()
	}
	if event.MetadataJSON == nil {
		event.MetadataJSON = map[string]interface{}{"source": "gateway"}
	}
	s.auditEvents = append([]AuditEvent{event}, s.auditEvents...)
	return event
}
func (s *Store) ListToolCallEvents() ListResponse[ToolCallEvent] {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return ListResponse[ToolCallEvent]{Items: cloneSlice(s.toolCallEvents)}
}
func (s *Store) ListHealth() ListResponse[ServerHealth] {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return ListResponse[ServerHealth]{Items: cloneSlice(s.health)}
}

func (s *Store) SetEmergencyDeny(input EmergencyDeny, auth AuthContext, traceID string) EmergencyDeny {
	s.mu.Lock()
	defer s.mu.Unlock()
	input.Enabled = true
	if input.Reason == "" {
		input.Reason = "Emergency deny enabled"
	}
	if !input.Global && !input.HighCritical && len(input.ServerIDs)+len(input.ServerSlugs)+len(input.ToolNames)+len(input.SubjectIDs)+len(input.ClientIDs) == 0 {
		input.Global = true
	}
	input.CreatedAt = Now()
	s.emergencyDeny = &input
	s.recordAuditLocked(auth, traceID, "emergency_policy.enabled", "", "", PolicyDeny, RiskLow, input)
	return input
}
func (s *Store) DisableEmergencyDeny(auth AuthContext, traceID string) EmergencyDeny {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := EmergencyDeny{Enabled: false, Reason: "Emergency deny disabled", CreatedAt: Now()}
	s.emergencyDeny = &out
	s.recordAuditLocked(auth, traceID, "emergency_policy.disabled", "", "", PolicyAllow, RiskLow, nil)
	return out
}
func (s *Store) RevokeServerGrants(serverID string, auth AuthContext, traceID string) (map[string]interface{}, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, err := s.getServerLocked(serverID); err != nil {
		return nil, err
	}
	revoked := 0
	for i := range s.grants {
		if s.grants[i].ServerID == serverID && s.grants[i].Enabled {
			s.grants[i].Enabled = false
			revoked++
		}
	}
	s.recordAuditLocked(auth, traceID, "admin.server_grants.revoked", serverID, "", PolicyDeny, RiskLow, nil)
	return map[string]interface{}{"revoked": revoked, "serverId": serverID}, nil
}

func (s *Store) UpsertHealth(result ServerHealth) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if result.ID == "" {
		result.ID = NewID()
	}
	if result.CheckedAt == "" {
		result.CheckedAt = Now()
	}
	s.health = append([]ServerHealth{result}, s.health...)
}
func (s *Store) AddAudit(event AuditEvent) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if event.ID == "" {
		event.ID = NewID()
	}
	if event.Timestamp == "" {
		event.Timestamp = Now()
	}
	if event.MetadataJSON == nil {
		event.MetadataJSON = map[string]interface{}{}
	}
	s.auditEvents = append([]AuditEvent{event}, s.auditEvents...)
}

func (s *Store) SnapshotGatewayRegistry() []GatewayServerSnapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]GatewayServerSnapshot, 0, len(s.servers))
	for _, server := range s.servers {
		out = append(out, GatewayServerSnapshot{Server: server, Tools: s.toolsForServerLocked(server.ID), Grants: s.grantsForServerLocked(server.ID), EmergencyDeny: s.emergencyDeny})
	}
	return out
}

type GatewayServerSnapshot struct {
	Server        MCPServer
	Tools         []MCPTool
	Grants        []Grant
	EmergencyDeny *EmergencyDeny
}

func (s *Store) getServerLocked(id string) (MCPServer, error) {
	idx := s.serverIndexLocked(id)
	if idx < 0 {
		return MCPServer{}, ErrNotFound
	}
	return s.servers[idx], nil
}
func (s *Store) serverIndexLocked(id string) int {
	for i, item := range s.servers {
		if item.ID == id {
			return i
		}
	}
	return -1
}
func (s *Store) toolIndexLocked(id string) int {
	for i, item := range s.tools {
		if item.ID == id {
			return i
		}
	}
	return -1
}
func (s *Store) versionIndexLocked(serverID, versionID string) int {
	for i, item := range s.versions {
		if item.ServerID == serverID && item.ID == versionID {
			return i
		}
	}
	return -1
}
func (s *Store) grantIndexLocked(id string) int {
	for i, item := range s.grants {
		if item.ID == id {
			return i
		}
	}
	return -1
}
func (s *Store) approvalIndexLocked(id string) int {
	for i, item := range s.approvals {
		if item.ID == id {
			return i
		}
	}
	return -1
}

func (s *Store) toolsForServerLocked(serverID string) []MCPTool {
	var out []MCPTool
	for _, tool := range s.tools {
		if tool.ServerID == serverID {
			out = append(out, tool)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}
func (s *Store) grantsForServerLocked(serverID string) []Grant {
	var out []Grant
	for _, grant := range s.grants {
		if grant.ServerID == serverID {
			out = append(out, grant)
		}
	}
	return out
}
func (s *Store) deactivateVersionsLocked(serverID, status, exceptID string) {
	now := Now()
	for i := range s.versions {
		if s.versions[i].ServerID == serverID && s.versions[i].ID != exceptID && s.versions[i].Status == "active" {
			s.versions[i].Status = status
			s.versions[i].UpdatedAt = now
			if status == "rolled_back" {
				s.versions[i].RolledBackAt = now
			}
		}
	}
}

func (s *Store) recordAuditLocked(auth AuthContext, traceID, eventType, serverID, toolName string, effect PolicyEffect, risk RiskLevel, argument interface{}) {
	if traceID == "" {
		traceID = NewID()
	}
	teamID := ""
	if len(auth.TeamIDs) > 0 {
		teamID = auth.TeamIDs[0]
	}
	s.auditEvents = append([]AuditEvent{{ID: NewID(), Timestamp: Now(), UserID: auth.UserID, TeamID: teamID, ProjectID: auth.ProjectID, ClientID: auth.ClientID, ServerID: serverID, ToolName: toolName, EventType: eventType, RiskLevel: risk, PolicyDecision: effect, TraceID: traceID, MetadataJSON: map[string]interface{}{"issuer": auth.Issuer}, ArgumentRedactedJSON: argument}}, s.auditEvents...)
}

func seedServer(id, slug, display, description string, transport ServerTransport, risk RiskLevel, upstream string, now string) MCPServer {
	return MCPServer{ID: id, Slug: slug, DisplayName: display, Description: description, OwnerTeamID: PlatformTeamID, Environment: EnvironmentDev, Transport: transport, UpstreamURL: upstream, Enabled: true, Published: true, RiskLevel: risk, CreatedAt: now, UpdatedAt: now}
}
func seedVersion(serverID, now string) MCPServerVersion {
	return MCPServerVersion{ID: NewID(), ServerID: serverID, Version: "1.0.0", Status: "active", ConfigHash: "seed-config-" + serverID, ToolSchemaHash: "seed-tool-schema-" + serverID, CreatedAt: now, UpdatedAt: now, ActivatedAt: now}
}
func seedTool(serverID, name, description string, risk RiskLevel, schema map[string]interface{}, now string) MCPTool {
	return MCPTool{ID: NewID(), ServerID: serverID, Name: name, Description: description, Enabled: true, RiskLevel: risk, InputSchema: schema, DiscoveredAt: now, LastSeenAt: now}
}
func emptySchema() map[string]interface{} {
	return map[string]interface{}{"type": "object", "properties": map[string]interface{}{}, "additionalProperties": false}
}

func Now() string { return time.Now().UTC().Format(time.RFC3339Nano) }

func NewID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("generated-%d", time.Now().UnixNano())
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	encoded := hex.EncodeToString(b)
	return encoded[0:8] + "-" + encoded[8:12] + "-" + encoded[12:16] + "-" + encoded[16:20] + "-" + encoded[20:32]
}

func cloneSlice[T any](in []T) []T { out := make([]T, len(in)); copy(out, in); return out }

func stringSlice(value interface{}) ([]string, bool) {
	raw, ok := value.([]interface{})
	if !ok {
		if typed, ok := value.([]string); ok {
			return typed, true
		}
		return nil, false
	}
	out := make([]string, 0, len(raw))
	for _, item := range raw {
		text, ok := item.(string)
		if !ok || text == "" {
			return nil, false
		}
		out = append(out, text)
	}
	return out, true
}

func auditMatches(event AuditEvent, filters map[string]string) bool {
	checks := map[string]string{"user": event.UserID, "team": event.TeamID, "project": event.ProjectID, "server": event.ServerID, "tool": event.ToolName, "event_type": event.EventType, "policy_decision": string(event.PolicyDecision), "risk_level": string(event.RiskLevel), "trace_id": event.TraceID}
	for key, actual := range checks {
		if expected := filters[key]; expected != "" && expected != actual {
			return false
		}
	}
	if from := filters["from"]; from != "" {
		if t, err := time.Parse(time.RFC3339, from); err == nil {
			et, _ := time.Parse(time.RFC3339Nano, event.Timestamp)
			if et.Before(t) {
				return false
			}
		}
	}
	if to := filters["to"]; to != "" {
		if t, err := time.Parse(time.RFC3339, to); err == nil {
			et, _ := time.Parse(time.RFC3339Nano, event.Timestamp)
			if et.After(t) {
				return false
			}
		}
	}
	return true
}
