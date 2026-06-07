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
	"syscall"
	"time"

	"github.com/mcp-hub/mcp-hub/internal/redaction"
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
	mu              sync.RWMutex
	persistPath     string
	users           []User
	teams           []Team
	teamMembers     []TeamMembership
	projects        []Project
	projectMembers  []ProjectMembership
	servers         []MCPServer
	tools           []MCPTool
	versions        []MCPServerVersion
	grants          []Grant
	approvals       []Approval
	oauthClients    []OAuthClient
	auditEvents     []AuditEvent
	auditExports    []AuditExportJob
	toolCallEvents  []ToolCallEvent
	rateLimits      []RateLimitBucket
	health          []ServerHealth
	emergencyDeny   *EmergencyDeny
	secretBindings  []SecretBinding
	schemaSnapshots []ToolSchemaSnapshot
	schemaDiffs     []SchemaDiff
}

type snapshot struct {
	Users           []User               `json:"users"`
	Teams           []Team               `json:"teams"`
	TeamMembers     []TeamMembership     `json:"teamMembers"`
	Projects        []Project            `json:"projects"`
	ProjectMembers  []ProjectMembership  `json:"projectMembers"`
	Servers         []MCPServer          `json:"servers"`
	Tools           []MCPTool            `json:"tools"`
	Versions        []MCPServerVersion   `json:"versions"`
	Grants          []Grant              `json:"grants"`
	Approvals       []Approval           `json:"approvals"`
	OAuthClients    []OAuthClient        `json:"oauthClients"`
	AuditEvents     []AuditEvent         `json:"auditEvents"`
	AuditExports    []AuditExportJob     `json:"auditExports"`
	ToolCallEvents  []ToolCallEvent      `json:"toolCallEvents"`
	RateLimits      []RateLimitBucket    `json:"rateLimits"`
	Health          []ServerHealth       `json:"health"`
	EmergencyDeny   *EmergencyDeny       `json:"emergencyDeny,omitempty"`
	SecretBindings  []SecretBinding      `json:"secretBindings"`
	SchemaSnapshots []ToolSchemaSnapshot `json:"schemaSnapshots"`
	SchemaDiffs     []SchemaDiff         `json:"schemaDiffs"`
}

func NewSeedStore() *Store {
	now := Now()
	store := &Store{
		users: []User{
			{ID: AdminUserID, Email: "admin@example.com", DisplayName: "Admin User", Admin: true, CreatedAt: now},
		},
		teams: []Team{
			{ID: PlatformTeamID, Slug: "platform", DisplayName: "Platform Team", CreatedAt: now},
		},
		teamMembers: []TeamMembership{
			{TeamID: PlatformTeamID, UserID: AdminUserID, Role: "admin", CreatedAt: now},
		},
		projects: []Project{
			{ID: SampleProjectID, Slug: "sample", DisplayName: "Sample Project", OwnerTeamID: PlatformTeamID, Environment: EnvironmentDev, CreatedAt: now},
		},
		projectMembers: []ProjectMembership{
			{ProjectID: SampleProjectID, SubjectType: SubjectTeam, SubjectID: PlatformTeamID, Role: "admin", CreatedAt: now},
		},
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
		oauthClients: []OAuthClient{
			seedOAuthClient("mcp-client", "Local MCP Client", now, []string{"http://localhost:3000/oauth/callback", "http://127.0.0.1:3000/oauth/callback"}),
			seedOAuthClient("local-dev-client", "Local Development Client", now, []string{"http://localhost:3000/oauth/callback", "http://127.0.0.1:3000/oauth/callback"}),
			seedOAuthClient("oidc-client", "OIDC Gateway Client", now, []string{"http://localhost:3000/oauth/callback", "http://127.0.0.1:3000/oauth/callback"}),
		},
		auditEvents:    []AuditEvent{{ID: NewID(), Timestamp: now, UserID: AdminUserID, TeamID: PlatformTeamID, ProjectID: SampleProjectID, ClientID: "local-dev-client", ServerID: K8sReadonlyID, ToolName: "list_namespaces", EventType: "seed.audit_event", RiskLevel: RiskMedium, PolicyDecision: PolicyAllow, TraceID: "seed-trace", MetadataJSON: map[string]interface{}{"source": "seed"}}},
		toolCallEvents: []ToolCallEvent{{ID: NewID(), AuditEventID: "seed-audit-event", ServerID: K8sReadonlyID, ToolName: "list_namespaces", Status: "ok", LatencyMS: 12, CreatedAt: now}},
		health:         []ServerHealth{{ID: NewID(), ServerID: K8sReadonlyID, Status: "healthy", LatencyMS: 10, CheckedAt: now}},
	}
	store.recordSchemaSnapshotLocked(K8sReadonlyID, "seed")
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
	} else if err == nil {
		_ = s.saveLocked()
	}
}

func (s *Store) Refresh() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.loadLocked()
}

func (s *Store) Save() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.saveLocked()
}

func (s *Store) loadLocked() error {
	if s.persistPath == "" {
		return nil
	}
	return s.withPersistenceLockLocked(func() error { return s.loadSnapshotLocked() })
}

func (s *Store) loadSnapshotLocked() error {
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
	s.users = cloneSlice(state.Users)
	s.teams = cloneSlice(state.Teams)
	s.teamMembers = cloneSlice(state.TeamMembers)
	s.projects = cloneSlice(state.Projects)
	s.projectMembers = cloneSlice(state.ProjectMembers)
	s.servers = cloneSlice(state.Servers)
	s.tools = cloneSlice(state.Tools)
	s.versions = cloneSlice(state.Versions)
	s.grants = cloneSlice(state.Grants)
	s.approvals = cloneSlice(state.Approvals)
	s.oauthClients = cloneSlice(state.OAuthClients)
	if len(s.oauthClients) == 0 {
		now := Now()
		s.oauthClients = []OAuthClient{seedOAuthClient("mcp-client", "Local MCP Client", now, []string{"http://localhost:3000/oauth/callback", "http://127.0.0.1:3000/oauth/callback"}), seedOAuthClient("local-dev-client", "Local Development Client", now, []string{"http://localhost:3000/oauth/callback", "http://127.0.0.1:3000/oauth/callback"}), seedOAuthClient("oidc-client", "OIDC Gateway Client", now, []string{"http://localhost:3000/oauth/callback", "http://127.0.0.1:3000/oauth/callback"})}
	}
	s.auditEvents = cloneSlice(state.AuditEvents)
	s.auditExports = cloneSlice(state.AuditExports)
	s.toolCallEvents = cloneSlice(state.ToolCallEvents)
	s.rateLimits = cloneSlice(state.RateLimits)
	s.health = cloneSlice(state.Health)
	s.emergencyDeny = state.EmergencyDeny
	s.secretBindings = cloneSlice(state.SecretBindings)
	s.schemaSnapshots = cloneSlice(state.SchemaSnapshots)
	s.schemaDiffs = cloneSlice(state.SchemaDiffs)
	s.backfillSeedDataLocked()
	return nil
}

func (s *Store) saveLocked() error {
	if s.persistPath == "" {
		return nil
	}
	return s.withPersistenceLockLocked(func() error {
		state := snapshotFromStoreLocked(s)
		latest := state
		if err := s.loadSnapshotInto(&latest); err != nil {
			if !errors.Is(err, os.ErrNotExist) {
				return err
			}
		} else {
			state.AuditEvents = mergeAuditEvents(state.AuditEvents, latest.AuditEvents)
			state.RateLimits = mergeRateLimitBuckets(state.RateLimits, latest.RateLimits, time.Now().UTC())
		}
		s.auditEvents = cloneSlice(state.AuditEvents)
		s.rateLimits = cloneSlice(state.RateLimits)
		return s.saveSnapshotLocked(state)
	})
}

func snapshotFromStoreLocked(s *Store) snapshot {
	return snapshot{Users: s.users, Teams: s.teams, TeamMembers: s.teamMembers, Projects: s.projects, ProjectMembers: s.projectMembers, Servers: s.servers, Tools: s.tools, Versions: s.versions, Grants: s.grants, Approvals: s.approvals, OAuthClients: s.oauthClients, AuditEvents: s.auditEvents, AuditExports: s.auditExports, ToolCallEvents: s.toolCallEvents, RateLimits: s.rateLimits, Health: s.health, EmergencyDeny: s.emergencyDeny, SecretBindings: s.secretBindings, SchemaSnapshots: s.schemaSnapshots, SchemaDiffs: s.schemaDiffs}
}

func (s *Store) saveSnapshotLocked(state snapshot) error {
	if err := os.MkdirAll(filepath.Dir(s.persistPath), 0o700); err != nil {
		return err
	}
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

func (s *Store) withPersistenceLockLocked(fn func() error) error {
	if s.persistPath == "" {
		return fn()
	}
	if err := os.MkdirAll(filepath.Dir(s.persistPath), 0o700); err != nil {
		return err
	}
	lockPath := s.persistPath + ".lock"
	lock, err := os.OpenFile(lockPath, os.O_CREATE|os.O_RDWR, 0o600)
	if err != nil {
		return err
	}
	defer lock.Close()
	if err := syscall.Flock(int(lock.Fd()), syscall.LOCK_EX); err != nil {
		return err
	}
	defer syscall.Flock(int(lock.Fd()), syscall.LOCK_UN)
	return fn()
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
	if len(tools) == 0 {
		return MCPServer{}, fmt.Errorf("%w: at least one tool is required", ErrValidation)
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
	if !validEnvironment(input.Environment) || !validTransport(input.Transport) || !validRisk(input.RiskLevel) {
		return MCPServer{}, fmt.Errorf("%w: environment, transport, or riskLevel is invalid", ErrValidation)
	}
	input.Published = input.Enabled
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.teamIndexLocked(input.OwnerTeamID) < 0 {
		return MCPServer{}, ErrNotFound
	}
	for _, server := range s.servers {
		if server.Slug == input.Slug {
			return MCPServer{}, fmt.Errorf("%w: server slug already exists", ErrValidation)
		}
	}
	seenTools := map[string]bool{}
	for _, tool := range tools {
		if strings.TrimSpace(tool.Name) == "" {
			return MCPServer{}, fmt.Errorf("%w: tool name is required", ErrValidation)
		}
		if seenTools[tool.Name] {
			return MCPServer{}, fmt.Errorf("%w: duplicate tool name", ErrValidation)
		}
		seenTools[tool.Name] = true
		if tool.RiskLevel != "" && !validRisk(tool.RiskLevel) {
			return MCPServer{}, fmt.Errorf("%w: tool riskLevel is invalid", ErrValidation)
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
	s.recordSchemaSnapshotLocked(input.ID, "catalog.create")
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
	if v, ok := intValue(patch["timeoutMs"]); ok {
		s.servers[idx].TimeoutMS = v
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
		if !validRisk(RiskLevel(v)) {
			return MCPTool{}, fmt.Errorf("%w: riskLevel is invalid", ErrValidation)
		}
		s.tools[idx].RiskLevel = RiskLevel(v)
	}
	if schema, ok := objectMap(patch["inputSchema"]); ok {
		s.tools[idx].InputSchema = schema
	}
	s.tools[idx].LastSeenAt = Now()
	if _, ok := patch["inputSchema"]; ok {
		s.recordSchemaSnapshotLocked(serverID, "tool.patch")
	}
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
	if input.CreatedBy == "" {
		input.CreatedBy = auth.UserID
	}
	if input.Status == "" {
		input.Status = "draft"
	}
	if input.RolloutStatus == "" {
		input.RolloutStatus = "pending"
	}
	if input.ToolSchemaHash == "" {
		input.ToolSchemaHash = schemaHashFromToolsLocked(s.toolsForServerLocked(serverID))
	}
	if input.Status == "active" {
		input.ActivatedAt = now
		input.RolloutStatus = "healthy"
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
	s.versions[idx].RolloutStatus = "healthy"
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
	return s.latestSchemaDiffLocked(serverID), nil
}

func (s *Store) ListGrants() ListResponse[Grant] {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return ListResponse[Grant]{Items: cloneSlice(s.grants)}
}

func (s *Store) ValidateOAuthClient(clientID string, redirectURI string, allowDynamic bool) (OAuthClient, error) {
	if strings.TrimSpace(clientID) == "" {
		return OAuthClient{}, fmt.Errorf("%w: client_id is required", ErrUnauthorized)
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, client := range s.oauthClients {
		if client.ClientID != clientID {
			continue
		}
		if !client.Enabled {
			return OAuthClient{}, fmt.Errorf("%w: client is disabled", ErrUnauthorized)
		}
		if strings.TrimSpace(redirectURI) != "" && !containsValue(client.RedirectURIs, redirectURI) {
			return OAuthClient{}, fmt.Errorf("%w: redirect_uri is not registered for client", ErrUnauthorized)
		}
		return client, nil
	}
	if allowDynamic {
		return OAuthClient{ID: clientID, ClientID: clientID, DisplayName: clientID, DCRAllowed: true, Enabled: true, CreatedAt: Now()}, nil
	}
	return OAuthClient{}, fmt.Errorf("%w: client is not registered", ErrUnauthorized)
}

func (s *Store) CreateGrant(input Grant, auth AuthContext, traceID string, argument interface{}) (Grant, error) {
	if input.SubjectID == "" || input.ProjectID == "" || input.ServerID == "" || len(input.AllowedTools) == 0 || input.Reason == "" {
		return Grant{}, fmt.Errorf("%w: subjectId, projectId, serverId, allowedTools, and reason are required", ErrValidation)
	}
	if input.ExpiresAt != "" {
		if _, err := time.Parse(time.RFC3339, input.ExpiresAt); err != nil {
			return Grant{}, fmt.Errorf("%w: expiresAt must be RFC3339", ErrValidation)
		}
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, err := s.getServerLocked(input.ServerID); err != nil {
		return Grant{}, err
	}
	if s.projectIndexLocked(input.ProjectID) < 0 {
		return Grant{}, ErrNotFound
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
	if input.RequestedExpiresAt != "" {
		if _, err := time.Parse(time.RFC3339, input.RequestedExpiresAt); err != nil {
			return Approval{}, fmt.Errorf("%w: requestedExpiresAt must be RFC3339", ErrValidation)
		}
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
	if s.projectIndexLocked(input.ProjectID) < 0 {
		return Approval{}, ErrNotFound
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
		expiresAt := s.approvals[idx].RequestedExpiresAt
		if v, ok := patch["expiresAt"].(string); ok {
			if v != "" {
				if _, err := time.Parse(time.RFC3339, v); err != nil {
					return Approval{}, fmt.Errorf("%w: expiresAt must be RFC3339", ErrValidation)
				}
			}
			expiresAt = v
		}
		s.grants = append(s.grants, Grant{ID: NewID(), SubjectType: s.approvals[idx].SubjectType, SubjectID: s.approvals[idx].SubjectID, ProjectID: s.approvals[idx].ProjectID, ServerID: s.approvals[idx].ServerID, AllowedTools: allowed, Environment: s.approvals[idx].Environment, ExpiresAt: expiresAt, ApprovedBy: auth.UserID, Reason: s.approvals[idx].Reason, Enabled: true, CreatedAt: now})
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
	event = sanitizeAuditEvent(event)
	s.auditEvents = append([]AuditEvent{event}, s.auditEvents...)
	_ = s.persistAuditEventLocked(event)
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
	s.recordAuditLocked(auth, traceID, "emergency_policy.enabled", "", "", PolicyDeny, RiskCritical, input)
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
	s.recordAuditLocked(auth, traceID, "admin.server_grants.revoked", serverID, "", PolicyDeny, RiskCritical, nil)
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
	event = sanitizeAuditEvent(event)
	s.auditEvents = append([]AuditEvent{event}, s.auditEvents...)
	_ = s.persistAuditEventLocked(event)
}

func (s *Store) IncrementRateLimitBucket(key string, window time.Duration) (int, time.Time, error) {
	if strings.TrimSpace(key) == "" {
		key = "anonymous"
	}
	if window <= 0 {
		window = time.Minute
	}
	now := time.Now().UTC()
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.persistPath == "" {
		count, resetAt := incrementRateLimitBuckets(&s.rateLimits, key, window, now)
		return count, resetAt, nil
	}
	var count int
	var resetAt time.Time
	err := s.withPersistenceLockLocked(func() error {
		state := snapshotFromStoreLocked(s)
		if err := s.loadSnapshotInto(&state); err != nil {
			if !errors.Is(err, os.ErrNotExist) {
				return err
			}
		}
		count, resetAt = incrementRateLimitBuckets(&state.RateLimits, key, window, now)
		if err := s.saveSnapshotLocked(state); err != nil {
			return err
		}
		s.rateLimits = cloneSlice(state.RateLimits)
		return nil
	})
	return count, resetAt, err
}

func incrementRateLimitBuckets(buckets *[]RateLimitBucket, key string, window time.Duration, now time.Time) (int, time.Time) {
	*buckets = pruneRateLimitBuckets(*buckets, now)
	for i := range *buckets {
		if (*buckets)[i].Key != key {
			continue
		}
		resetAt, err := time.Parse(time.RFC3339Nano, (*buckets)[i].ResetAt)
		if err != nil || !now.Before(resetAt) {
			resetAt = now.Add(window)
			(*buckets)[i].ResetAt = resetAt.Format(time.RFC3339Nano)
			(*buckets)[i].Count = 0
		}
		(*buckets)[i].Count++
		return (*buckets)[i].Count, resetAt
	}
	resetAt := now.Add(window)
	*buckets = append(*buckets, RateLimitBucket{Key: key, Count: 1, ResetAt: resetAt.Format(time.RFC3339Nano)})
	return 1, resetAt
}

func mergeAuditEvents(current []AuditEvent, latest []AuditEvent) []AuditEvent {
	seen := map[string]bool{}
	merged := make([]AuditEvent, 0, len(current)+len(latest))
	for _, event := range append(cloneSlice(current), latest...) {
		if event.ID == "" || seen[event.ID] {
			continue
		}
		seen[event.ID] = true
		merged = append(merged, event)
	}
	sort.SliceStable(merged, func(i, j int) bool { return merged[i].Timestamp > merged[j].Timestamp })
	return merged
}

func mergeRateLimitBuckets(current []RateLimitBucket, latest []RateLimitBucket, now time.Time) []RateLimitBucket {
	merged := map[string]RateLimitBucket{}
	for _, bucket := range append(pruneRateLimitBuckets(current, now), pruneRateLimitBuckets(latest, now)...) {
		if bucket.Key == "" {
			continue
		}
		if existing, ok := merged[bucket.Key]; !ok || newerRateLimitBucket(bucket, existing) {
			merged[bucket.Key] = bucket
		}
	}
	out := make([]RateLimitBucket, 0, len(merged))
	for _, bucket := range merged {
		out = append(out, bucket)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Key < out[j].Key })
	return out
}

func pruneRateLimitBuckets(buckets []RateLimitBucket, now time.Time) []RateLimitBucket {
	out := make([]RateLimitBucket, 0, len(buckets))
	for _, bucket := range buckets {
		resetAt, err := time.Parse(time.RFC3339Nano, bucket.ResetAt)
		if err != nil || now.Before(resetAt) {
			out = append(out, bucket)
		}
	}
	return out
}

func newerRateLimitBucket(candidate RateLimitBucket, existing RateLimitBucket) bool {
	candidateReset, candidateErr := time.Parse(time.RFC3339Nano, candidate.ResetAt)
	existingReset, existingErr := time.Parse(time.RFC3339Nano, existing.ResetAt)
	if candidateErr != nil {
		return false
	}
	if existingErr != nil || candidateReset.After(existingReset) {
		return true
	}
	if candidateReset.Equal(existingReset) && candidate.Count > existing.Count {
		return true
	}
	return false
}

func (s *Store) persistAuditEventLocked(event AuditEvent) error {
	if s.persistPath == "" {
		return nil
	}
	return s.withPersistenceLockLocked(func() error {
		state := snapshotFromStoreLocked(s)
		if err := s.loadSnapshotInto(&state); err != nil {
			if errors.Is(err, os.ErrNotExist) {
				return s.saveSnapshotLocked(state)
			}
			return err
		}
		for _, existing := range state.AuditEvents {
			if existing.ID == event.ID {
				return nil
			}
		}
		state.AuditEvents = append([]AuditEvent{event}, state.AuditEvents...)
		return s.saveSnapshotLocked(state)
	})
}

func (s *Store) loadSnapshotInto(state *snapshot) error {
	data, err := os.ReadFile(s.persistPath)
	if err != nil {
		return err
	}
	if len(strings.TrimSpace(string(data))) == 0 {
		return nil
	}
	return json.Unmarshal(data, state)
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
	event := sanitizeAuditEvent(AuditEvent{ID: NewID(), Timestamp: Now(), UserID: auth.UserID, TeamID: teamID, ProjectID: auth.ProjectID, ClientID: auth.ClientID, ServerID: serverID, ToolName: toolName, EventType: eventType, RiskLevel: risk, PolicyDecision: effect, TraceID: traceID, MetadataJSON: map[string]interface{}{"issuer": auth.Issuer}, ArgumentRedactedJSON: argument})
	s.auditEvents = append([]AuditEvent{event}, s.auditEvents...)
}

func sanitizeAuditEvent(event AuditEvent) AuditEvent {
	event.ArgumentRedactedJSON = redaction.Redact(event.ArgumentRedactedJSON)
	if event.ArgumentRedactedJSON != nil && event.ArgumentHash == "" {
		event.ArgumentHash = redaction.Hash(event.ArgumentRedactedJSON)
	}
	if event.MetadataJSON == nil {
		event.MetadataJSON = map[string]interface{}{}
	}
	if redacted, ok := redaction.Redact(event.MetadataJSON).(map[string]interface{}); ok {
		event.MetadataJSON = redacted
	}
	return event
}

func seedServer(id, slug, display, description string, transport ServerTransport, risk RiskLevel, upstream string, now string) MCPServer {
	return MCPServer{ID: id, Slug: slug, DisplayName: display, Description: description, OwnerTeamID: PlatformTeamID, Environment: EnvironmentDev, Transport: transport, UpstreamURL: upstream, Enabled: true, Published: true, RiskLevel: risk, CreatedAt: now, UpdatedAt: now}
}
func seedVersion(serverID, now string) MCPServerVersion {
	return MCPServerVersion{ID: NewID(), ServerID: serverID, Version: "1.0.0", Status: "active", ConfigHash: "seed-config-" + serverID, ToolSchemaHash: "seed-tool-schema-" + serverID, CreatedAt: now, UpdatedAt: now, ActivatedAt: now}
}
func seedOAuthClient(clientID, display, now string, redirects []string) OAuthClient {
	return OAuthClient{ID: NewID(), ClientID: clientID, DisplayName: display, OwnerTeamID: PlatformTeamID, RedirectURIs: redirects, Enabled: true, CreatedAt: now}
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

func containsValue(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func intValue(value interface{}) (int, bool) {
	switch typed := value.(type) {
	case int:
		return typed, true
	case float64:
		return int(typed), true
	case json.Number:
		parsed, err := typed.Int64()
		return int(parsed), err == nil
	default:
		return 0, false
	}
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
