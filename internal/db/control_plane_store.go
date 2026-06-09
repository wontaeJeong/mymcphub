package db

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/url"
	"sort"
	"strings"
	"time"
)

func (s *Store) ListServersWithOptions(options ListOptions) ListResponse[MCPServer] {
	s.mu.RLock()
	defer s.mu.RUnlock()
	options = normalizeListOptions(options)
	filtered := make([]MCPServer, 0, len(s.servers))
	for _, server := range s.servers {
		if matchesServerFilters(server, options.Filters) {
			filtered = append(filtered, server)
		}
	}
	return paginateByID(filtered, options)
}

func (s *Store) DeleteServer(id string, auth AuthContext, traceID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	idx := s.serverIndexLocked(id)
	if idx < 0 {
		return ErrNotFound
	}
	server := s.servers[idx]
	s.servers = append(s.servers[:idx], s.servers[idx+1:]...)
	s.tools = filterSlice(s.tools, func(tool MCPTool) bool { return tool.ServerID != id })
	s.versions = filterSlice(s.versions, func(version MCPServerVersion) bool { return version.ServerID != id })
	s.grants = filterSlice(s.grants, func(grant Grant) bool { return grant.ServerID != id })
	s.approvals = filterSlice(s.approvals, func(approval Approval) bool { return approval.ServerID != id })
	s.health = filterSlice(s.health, func(health ServerHealth) bool { return health.ServerID != id })
	s.secretBindings = filterSlice(s.secretBindings, func(binding SecretBinding) bool { return !(binding.ScopeType == "server" && binding.ScopeID == id) })
	s.schemaSnapshots = filterSlice(s.schemaSnapshots, func(snapshot ToolSchemaSnapshot) bool { return snapshot.ServerID != id })
	s.schemaDiffs = filterSlice(s.schemaDiffs, func(diff SchemaDiff) bool { return diff.ServerID != id })
	s.recordAuditLocked(auth, traceID, "mcp_server.deleted", id, "", PolicyDeny, server.RiskLevel, map[string]interface{}{"slug": server.Slug})
	return nil
}

func (s *Store) ListUsers() ListResponse[User] {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return ListResponse[User]{Items: cloneSlice(s.users)}
}

func (s *Store) CreateUser(input User, auth AuthContext, traceID string) (User, error) {
	if strings.TrimSpace(input.Email) == "" || strings.TrimSpace(input.DisplayName) == "" {
		return User{}, fmt.Errorf("%w: email and displayName are required", ErrValidation)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, user := range s.users {
		if strings.EqualFold(user.Email, input.Email) {
			return User{}, fmt.Errorf("%w: user email already exists", ErrValidation)
		}
	}
	input.ID = firstNonEmptyString(input.ID, NewID())
	input.CreatedAt = Now()
	s.users = append(s.users, input)
	s.recordAuditLocked(auth, traceID, "tenancy.user.created", "", "", PolicyAllow, RiskLow, map[string]interface{}{"userId": input.ID})
	return input, nil
}

func (s *Store) ListTeams() ListResponse[Team] {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return ListResponse[Team]{Items: cloneSlice(s.teams)}
}

func (s *Store) CreateTeam(input Team, auth AuthContext, traceID string) (Team, error) {
	if strings.TrimSpace(input.Slug) == "" || strings.TrimSpace(input.DisplayName) == "" {
		return Team{}, fmt.Errorf("%w: slug and displayName are required", ErrValidation)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, team := range s.teams {
		if team.Slug == input.Slug {
			return Team{}, fmt.Errorf("%w: team slug already exists", ErrValidation)
		}
	}
	input.ID = firstNonEmptyString(input.ID, NewID())
	input.CreatedAt = Now()
	s.teams = append(s.teams, input)
	s.recordAuditLocked(auth, traceID, "tenancy.team.created", "", "", PolicyAllow, RiskLow, map[string]interface{}{"teamId": input.ID})
	return input, nil
}

func (s *Store) AddTeamMember(input TeamMembership, auth AuthContext, traceID string) (TeamMembership, error) {
	if strings.TrimSpace(input.TeamID) == "" || strings.TrimSpace(input.UserID) == "" {
		return TeamMembership{}, fmt.Errorf("%w: teamId and userId are required", ErrValidation)
	}
	if strings.TrimSpace(input.Role) == "" {
		input.Role = "member"
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.teamIndexLocked(input.TeamID) < 0 || s.userIndexLocked(input.UserID) < 0 {
		return TeamMembership{}, ErrNotFound
	}
	for i, membership := range s.teamMembers {
		if membership.TeamID == input.TeamID && membership.UserID == input.UserID {
			input.CreatedAt = membership.CreatedAt
			s.teamMembers[i] = input
			s.recordAuditLocked(auth, traceID, "tenancy.team_member.updated", "", "", PolicyAllow, RiskLow, map[string]interface{}{"teamId": input.TeamID, "userId": input.UserID, "role": input.Role})
			return input, nil
		}
	}
	input.CreatedAt = Now()
	s.teamMembers = append(s.teamMembers, input)
	s.recordAuditLocked(auth, traceID, "tenancy.team_member.created", "", "", PolicyAllow, RiskLow, map[string]interface{}{"teamId": input.TeamID, "userId": input.UserID, "role": input.Role})
	return input, nil
}

func (s *Store) RemoveTeamMember(teamID, userID string, auth AuthContext, traceID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, membership := range s.teamMembers {
		if membership.TeamID == teamID && membership.UserID == userID {
			s.teamMembers = append(s.teamMembers[:i], s.teamMembers[i+1:]...)
			s.recordAuditLocked(auth, traceID, "tenancy.team_member.deleted", "", "", PolicyDeny, RiskLow, map[string]interface{}{"teamId": teamID, "userId": userID})
			return nil
		}
	}
	return ErrNotFound
}

func (s *Store) ListProjects() ListResponse[Project] {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return ListResponse[Project]{Items: cloneSlice(s.projects)}
}

func (s *Store) CreateProject(input Project, auth AuthContext, traceID string) (Project, error) {
	if strings.TrimSpace(input.Slug) == "" || strings.TrimSpace(input.DisplayName) == "" || strings.TrimSpace(input.OwnerTeamID) == "" {
		return Project{}, fmt.Errorf("%w: slug, displayName, and ownerTeamId are required", ErrValidation)
	}
	if input.Environment == "" {
		input.Environment = EnvironmentDev
	}
	if !validEnvironment(input.Environment) {
		return Project{}, fmt.Errorf("%w: environment is invalid", ErrValidation)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.teamIndexLocked(input.OwnerTeamID) < 0 {
		return Project{}, ErrNotFound
	}
	for _, project := range s.projects {
		if project.Slug == input.Slug {
			return Project{}, fmt.Errorf("%w: project slug already exists", ErrValidation)
		}
	}
	input.ID = firstNonEmptyString(input.ID, NewID())
	input.CreatedAt = Now()
	s.projects = append(s.projects, input)
	s.recordAuditLocked(auth, traceID, "tenancy.project.created", "", "", PolicyAllow, RiskLow, map[string]interface{}{"projectId": input.ID})
	return input, nil
}

func (s *Store) AddProjectMember(input ProjectMembership, auth AuthContext, traceID string) (ProjectMembership, error) {
	if strings.TrimSpace(input.ProjectID) == "" || strings.TrimSpace(input.SubjectID) == "" {
		return ProjectMembership{}, fmt.Errorf("%w: projectId and subjectId are required", ErrValidation)
	}
	if input.SubjectType == "" {
		input.SubjectType = SubjectUser
	}
	if strings.TrimSpace(input.Role) == "" {
		input.Role = "member"
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.projectIndexLocked(input.ProjectID) < 0 {
		return ProjectMembership{}, ErrNotFound
	}
	for i, membership := range s.projectMembers {
		if membership.ProjectID == input.ProjectID && membership.SubjectType == input.SubjectType && membership.SubjectID == input.SubjectID {
			input.CreatedAt = membership.CreatedAt
			s.projectMembers[i] = input
			s.recordAuditLocked(auth, traceID, "tenancy.project_member.updated", "", "", PolicyAllow, RiskLow, map[string]interface{}{"projectId": input.ProjectID, "subjectId": input.SubjectID, "role": input.Role})
			return input, nil
		}
	}
	input.CreatedAt = Now()
	s.projectMembers = append(s.projectMembers, input)
	s.recordAuditLocked(auth, traceID, "tenancy.project_member.created", "", "", PolicyAllow, RiskLow, map[string]interface{}{"projectId": input.ProjectID, "subjectId": input.SubjectID, "role": input.Role})
	return input, nil
}

func (s *Store) RemoveProjectMember(projectID string, subjectType GrantSubjectType, subjectID string, auth AuthContext, traceID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, membership := range s.projectMembers {
		if membership.ProjectID == projectID && membership.SubjectType == subjectType && membership.SubjectID == subjectID {
			s.projectMembers = append(s.projectMembers[:i], s.projectMembers[i+1:]...)
			s.recordAuditLocked(auth, traceID, "tenancy.project_member.deleted", "", "", PolicyDeny, RiskLow, map[string]interface{}{"projectId": projectID, "subjectId": subjectID})
			return nil
		}
	}
	return ErrNotFound
}

func (s *Store) PolicyInputFor(userID, projectID string) (PolicyInput, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	userIdx := s.userIndexLocked(userID)
	if userIdx < 0 {
		return PolicyInput{}, ErrNotFound
	}
	projectIdx := s.projectIndexLocked(firstNonEmptyString(projectID, SampleProjectID))
	if projectIdx < 0 {
		return PolicyInput{}, ErrNotFound
	}
	teamIDs := []string{}
	teams := []Team{}
	teamMemberships := []TeamMembership{}
	roles := []string{}
	for _, membership := range s.teamMembers {
		if membership.UserID == userID {
			teamIDs = append(teamIDs, membership.TeamID)
			teamMemberships = append(teamMemberships, membership)
			roles = append(roles, membership.Role)
			if idx := s.teamIndexLocked(membership.TeamID); idx >= 0 {
				teams = append(teams, s.teams[idx])
			}
		}
	}
	projectMemberships := []ProjectMembership{}
	for _, membership := range s.projectMembers {
		if membership.ProjectID == s.projects[projectIdx].ID && (membership.SubjectID == userID || containsString(teamIDs, membership.SubjectID)) {
			projectMemberships = append(projectMemberships, membership)
			roles = append(roles, membership.Role)
		}
	}
	user := s.users[userIdx]
	principal := AuthContext{UserID: user.ID, PrincipalType: SubjectUser, Email: user.Email, DisplayName: user.DisplayName, TeamIDs: teamIDs, Teams: teamIDs, Roles: dedupeStrings(roles), IsAdmin: user.Admin, IsPlatformAdmin: user.Admin || containsString(teamIDs, PlatformTeamID), ProjectID: s.projects[projectIdx].ID, AuthSource: "store", ClientID: "control-plane"}
	return PolicyInput{Principal: principal, Project: s.projects[projectIdx], Teams: teams, TeamMemberships: teamMemberships, ProjectMemberships: projectMemberships}, nil
}

func (s *Store) ListSecretBindings(filters map[string]string) ListResponse[SecretBinding] {
	s.mu.RLock()
	defer s.mu.RUnlock()
	items := make([]SecretBinding, 0, len(s.secretBindings))
	for _, binding := range s.secretBindings {
		if matchesSecretBinding(binding, filters) {
			items = append(items, binding)
		}
	}
	return ListResponse[SecretBinding]{Items: items}
}

func (s *Store) CreateSecretBinding(input SecretBinding, auth AuthContext, traceID string) (SecretBinding, error) {
	input.ScopeType = strings.ToLower(strings.TrimSpace(input.ScopeType))
	input.ScopeID = strings.TrimSpace(input.ScopeID)
	input.Provider = strings.ToLower(strings.TrimSpace(input.Provider))
	input.Ref = strings.TrimSpace(input.Ref)
	if strings.TrimSpace(input.ScopeType) == "" || strings.TrimSpace(input.ScopeID) == "" || strings.TrimSpace(input.Provider) == "" || strings.TrimSpace(input.Ref) == "" {
		return SecretBinding{}, fmt.Errorf("%w: scopeType, scopeId, provider, and ref are required", ErrValidation)
	}
	if !validSecretRef(input.Provider, input.Ref) {
		return SecretBinding{}, fmt.Errorf("%w: ref must be an approved secret reference URI", ErrValidation)
	}
	if input.ScopeType != "server" && input.ScopeType != "project" && input.ScopeType != "team" {
		return SecretBinding{}, fmt.Errorf("%w: scopeType must be server, project, or team", ErrValidation)
	}
	if input.LeaseExpiresAt != "" {
		if _, err := time.Parse(time.RFC3339, input.LeaseExpiresAt); err != nil {
			return SecretBinding{}, fmt.Errorf("%w: leaseExpiresAt must be RFC3339", ErrValidation)
		}
	}
	now := Now()
	input.ID = NewID()
	input.CreatedAt = now
	input.UpdatedAt = now
	s.mu.Lock()
	defer s.mu.Unlock()
	switch input.ScopeType {
	case "server":
		if s.serverIndexLocked(input.ScopeID) < 0 {
			return SecretBinding{}, ErrNotFound
		}
	case "project":
		if s.projectIndexLocked(input.ScopeID) < 0 {
			return SecretBinding{}, ErrNotFound
		}
	case "team":
		if s.teamIndexLocked(input.ScopeID) < 0 {
			return SecretBinding{}, ErrNotFound
		}
	}
	for _, binding := range s.secretBindings {
		if binding.ScopeType == input.ScopeType && binding.ScopeID == input.ScopeID && binding.Provider == input.Provider && binding.Ref == input.Ref {
			return SecretBinding{}, fmt.Errorf("%w: secret binding already exists", ErrValidation)
		}
	}
	s.secretBindings = append(s.secretBindings, input)
	s.recordAuditLocked(auth, traceID, "secret_binding.created", "", "", PolicyAllow, RiskLow, map[string]interface{}{"bindingId": input.ID, "scopeType": input.ScopeType, "scopeId": input.ScopeID, "provider": input.Provider, "refHash": redactedRefHash(input.Ref)})
	return input, nil
}

func (s *Store) DeleteSecretBinding(id string, auth AuthContext, traceID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, binding := range s.secretBindings {
		if binding.ID == id {
			s.secretBindings = append(s.secretBindings[:i], s.secretBindings[i+1:]...)
			s.recordAuditLocked(auth, traceID, "secret_binding.deleted", "", "", PolicyDeny, RiskLow, map[string]interface{}{"bindingId": id, "scopeType": binding.ScopeType, "scopeId": binding.ScopeID})
			return nil
		}
	}
	return ErrNotFound
}

func (s *Store) RolloutStatus(serverID string) (RolloutStatus, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if _, err := s.getServerLocked(serverID); err != nil {
		return RolloutStatus{}, err
	}
	status := RolloutStatus{ServerID: serverID, PendingVersions: []MCPServerVersion{}, RollbackTargets: []MCPServerVersion{}, GitOpsMetadata: map[string]string{}, UpdatedAt: Now()}
	var latest *MCPServerVersion
	for _, version := range s.versions {
		if version.ServerID != serverID {
			continue
		}
		copy := version
		if latest == nil || version.CreatedAt > latest.CreatedAt {
			latest = &copy
		}
		if version.Status == "active" {
			status.ActiveVersion = &copy
		}
		if version.Status == "draft" || version.Status == "pending" {
			status.PendingVersions = append(status.PendingVersions, version)
		}
		if version.Status == "deprecated" || version.Status == "rolled_back" {
			status.RollbackTargets = append(status.RollbackTargets, version)
		}
	}
	if status.ActiveVersion == nil && latest != nil {
		status.ActiveVersion = latest
	}
	if status.ActiveVersion != nil {
		status.GitOpsMetadata = gitOpsMetadata(*status.ActiveVersion)
	}
	return status, nil
}

func (s *Store) RecordCurrentSchemaSnapshot(serverID, source string) (ToolSchemaSnapshot, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, err := s.getServerLocked(serverID); err != nil {
		return ToolSchemaSnapshot{}, err
	}
	return s.recordSchemaSnapshotLocked(serverID, source), nil
}

func (s *Store) ListSchemaSnapshots(serverID string) (ListResponse[ToolSchemaSnapshot], error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if _, err := s.getServerLocked(serverID); err != nil {
		return ListResponse[ToolSchemaSnapshot]{}, err
	}
	items := []ToolSchemaSnapshot{}
	for _, snapshot := range s.schemaSnapshots {
		if snapshot.ServerID == serverID {
			items = append(items, snapshot)
		}
	}
	return ListResponse[ToolSchemaSnapshot]{Items: items}, nil
}

func (s *Store) ListSchemaDiffs(serverID string, options ListOptions) (ListResponse[SchemaDiff], error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if _, err := s.getServerLocked(serverID); err != nil {
		return ListResponse[SchemaDiff]{}, err
	}
	options = normalizeListOptions(options)
	items := []SchemaDiff{}
	for _, diff := range s.schemaDiffs {
		if diff.ServerID == serverID {
			items = append(items, diff)
		}
	}
	return paginateSchemaDiffs(items, options), nil
}

func (s *Store) RecordSchemaDiff(serverID, source string, changes []SchemaChange) (SchemaDiff, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, err := s.getServerLocked(serverID); err != nil {
		return SchemaDiff{}, err
	}
	return s.recordSchemaDiffLocked(serverID, source, changes), nil
}

func (s *Store) RecordSchemaDiffFromSnapshots(serverID, source string, previous, current []ToolSchemaSnapshotItem) (SchemaDiff, error) {
	previous = normalizeSnapshotItems(previous)
	current = normalizeSnapshotItems(current)
	changes := diffSnapshotItems(previous, current)
	return s.RecordSchemaDiff(serverID, source, changes)
}

func (s *Store) CreateAuditExportJob(filters map[string]string, format string, auth AuthContext, traceID string) (AuditExportJob, error) {
	format = strings.TrimSpace(format)
	if format == "" {
		format = "json"
	}
	if format != "json" && format != "csv" {
		return AuditExportJob{}, fmt.Errorf("%w: format must be json or csv", ErrValidation)
	}
	job := AuditExportJob{ID: NewID(), Status: "queued", Format: format, Filters: cloneStringMap(filters), RequestedBy: auth.UserID, RequestedAt: Now()}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.auditExports = append([]AuditExportJob{job}, s.auditExports...)
	s.recordAuditLocked(auth, traceID, "audit_export.requested", "", "", PolicyAllow, RiskLow, map[string]interface{}{"exportJobId": job.ID, "format": format, "filters": filters})
	return job, nil
}

func (s *Store) ListAuditExportJobs() ListResponse[AuditExportJob] {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return ListResponse[AuditExportJob]{Items: cloneSlice(s.auditExports)}
}

func (s *Store) ApplyKillSwitch(input KillSwitchRequest, auth AuthContext, traceID string) (KillSwitchResult, error) {
	if strings.TrimSpace(input.Reason) == "" {
		return KillSwitchResult{}, fmt.Errorf("%w: reason is required", ErrValidation)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	result := KillSwitchResult{Actions: []string{}, Metadata: map[string]interface{}{}}
	emergency := EmergencyDeny{Enabled: true, Reason: input.Reason, Global: input.Global, HighCritical: input.HighCritical, CreatedAt: Now()}
	serverID := strings.TrimSpace(input.ServerID)
	if serverID == "" && strings.TrimSpace(input.ServerSlug) != "" {
		server, err := s.getServerBySlugLocked(input.ServerSlug)
		if err != nil {
			return KillSwitchResult{}, err
		}
		serverID = server.ID
		emergency.ServerSlugs = append(emergency.ServerSlugs, server.Slug)
	}
	if serverID != "" {
		idx := s.serverIndexLocked(serverID)
		if idx < 0 {
			return KillSwitchResult{}, ErrNotFound
		}
		s.servers[idx].Enabled = false
		s.servers[idx].Published = false
		s.servers[idx].Quarantined = true
		s.servers[idx].UpdatedAt = Now()
		emergency.ServerIDs = append(emergency.ServerIDs, serverID)
		serverCopy := s.servers[idx]
		result.Server = &serverCopy
		result.Actions = append(result.Actions, "server_disabled")
	}
	toolID := strings.TrimSpace(input.ToolID)
	toolName := strings.TrimSpace(input.ToolName)
	if toolID != "" || toolName != "" {
		idx := s.toolIndexByIDOrNameLocked(serverID, toolID, toolName)
		if idx < 0 {
			return KillSwitchResult{}, ErrNotFound
		}
		s.tools[idx].Enabled = false
		s.tools[idx].LastSeenAt = Now()
		emergency.ToolNames = append(emergency.ToolNames, s.tools[idx].Name)
		toolCopy := s.tools[idx]
		result.Tool = &toolCopy
		result.Actions = append(result.Actions, "tool_disabled")
		if serverID == "" {
			serverID = s.tools[idx].ServerID
		}
	}
	if !emergency.Global && !emergency.HighCritical && len(emergency.ServerIDs)+len(emergency.ServerSlugs)+len(emergency.ToolNames) == 0 {
		emergency.Global = true
	}
	if input.RevokeGrants {
		for i := range s.grants {
			if (input.Global || serverID == "" || s.grants[i].ServerID == serverID) && s.grants[i].Enabled {
				s.grants[i].Enabled = false
				result.RevokedGrants++
			}
		}
		result.Actions = append(result.Actions, "grants_revoked")
	}
	s.emergencyDeny = &emergency
	result.EmergencyDeny = emergency
	if len(result.Actions) == 0 {
		result.Actions = append(result.Actions, "emergency_deny_enabled")
	}
	result.Metadata["traceId"] = traceID
	s.recordAuditLocked(auth, traceID, "admin.kill_switch.enabled", serverID, toolName, PolicyDeny, RiskCritical, map[string]interface{}{"reason": input.Reason, "actions": result.Actions, "revokedGrants": result.RevokedGrants})
	return result, nil
}

func (s *Store) recordSchemaSnapshotLocked(serverID, source string) ToolSchemaSnapshot {
	if source == "" {
		source = "api"
	}
	snapshot := ToolSchemaSnapshot{ID: NewID(), ServerID: serverID, Source: source, Tools: s.snapshotToolsLocked(serverID), CreatedAt: Now()}
	s.schemaSnapshots = append([]ToolSchemaSnapshot{snapshot}, s.schemaSnapshots...)
	return snapshot
}

func (s *Store) latestSchemaDiffLocked(serverID string) SchemaDiff {
	for _, diff := range s.schemaDiffs {
		if diff.ServerID == serverID {
			return diff
		}
	}
	var latest *ToolSchemaSnapshot
	var previous *ToolSchemaSnapshot
	for _, snapshot := range s.schemaSnapshots {
		if snapshot.ServerID != serverID {
			continue
		}
		if latest == nil {
			copy := snapshot
			latest = &copy
			continue
		}
		copy := snapshot
		previous = &copy
		break
	}
	if latest == nil {
		return SchemaDiff{ServerID: serverID, Status: "no_snapshot", ApprovalState: "not_required", GeneratedAt: Now(), Changes: []SchemaChange{}}
	}
	from := latest
	if previous != nil {
		from = previous
	}
	changes := diffSnapshotItems(from.Tools, latest.Tools)
	diff := SchemaDiff{ID: NewID(), ServerID: serverID, FromSnapshotID: from.ID, ToSnapshotID: latest.ID, Status: schemaDiffStatus(changes), ApprovalRequired: changesNeedApproval(changes), ApprovalState: schemaApprovalState(changes), GeneratedAt: Now(), Changes: changes}
	return diff
}

func (s *Store) recordSchemaDiffLocked(serverID, source string, changes []SchemaChange) SchemaDiff {
	if source == "" {
		source = "worker"
	}
	for i := range changes {
		if changes[i].ApprovalState == "" {
			changes[i].ApprovalState = approvalState(changes[i].ApprovalRequired)
		}
	}
	diff := SchemaDiff{ID: NewID(), ServerID: serverID, Status: schemaDiffStatus(changes), ApprovalRequired: changesNeedApproval(changes), ApprovalState: schemaApprovalState(changes), GeneratedAt: Now(), Changes: changes}
	diff.Changes = append([]SchemaChange{}, diff.Changes...)
	s.schemaDiffs = append([]SchemaDiff{diff}, s.schemaDiffs...)
	s.recordAuditLocked(AuthContext{}, NewID(), "schema.diff.recorded", serverID, "", PolicyAllow, RiskLow, map[string]interface{}{"source": source, "changeCount": len(changes), "approvalRequired": diff.ApprovalRequired})
	return diff
}

func (s *Store) snapshotToolsLocked(serverID string) []ToolSchemaSnapshotItem {
	items := []ToolSchemaSnapshotItem{}
	for _, tool := range s.tools {
		if tool.ServerID == serverID {
			items = append(items, ToolSchemaSnapshotItem{Name: tool.Name, Description: tool.Description, RiskLevel: tool.RiskLevel, InputSchema: cloneMap(tool.InputSchema), SchemaHash: schemaHash(tool.InputSchema)})
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].Name < items[j].Name })
	return items
}

func diffSnapshotItems(previous, current []ToolSchemaSnapshotItem) []SchemaChange {
	prev := map[string]ToolSchemaSnapshotItem{}
	curr := map[string]ToolSchemaSnapshotItem{}
	for _, item := range previous {
		prev[item.Name] = item
	}
	for _, item := range current {
		curr[item.Name] = item
	}
	changes := []SchemaChange{}
	seen := map[string]bool{}
	for name, item := range curr {
		seen[name] = true
		old, ok := prev[name]
		if !ok {
			changes = append(changes, SchemaChange{Type: "tool_added", ToolName: name, ToRiskLevel: item.RiskLevel, ApprovalRequired: highRisk(item.RiskLevel), ApprovalState: approvalState(highRisk(item.RiskLevel)), Details: map[string]interface{}{"schemaHash": item.SchemaHash}})
			continue
		}
		if old.SchemaHash != item.SchemaHash {
			changes = append(changes, SchemaChange{Type: "tool_input_schema_changed", ToolName: name, FromRiskLevel: old.RiskLevel, ToRiskLevel: item.RiskLevel, ApprovalRequired: true, ApprovalState: "pending", Details: map[string]interface{}{"fromSchemaHash": old.SchemaHash, "toSchemaHash": item.SchemaHash}})
		}
		if old.RiskLevel != item.RiskLevel {
			approval := highRisk(item.RiskLevel)
			changes = append(changes, SchemaChange{Type: "tool_risk_changed", ToolName: name, FromRiskLevel: old.RiskLevel, ToRiskLevel: item.RiskLevel, ApprovalRequired: approval, ApprovalState: approvalState(approval)})
		}
		if old.Description != item.Description {
			changes = append(changes, SchemaChange{Type: "tool_description_changed", ToolName: name, FromRiskLevel: old.RiskLevel, ToRiskLevel: item.RiskLevel, ApprovalRequired: false, ApprovalState: "not_required"})
		}
	}
	for name, old := range prev {
		if !seen[name] {
			changes = append(changes, SchemaChange{Type: "tool_removed", ToolName: name, FromRiskLevel: old.RiskLevel, ApprovalRequired: true, ApprovalState: "pending", Details: map[string]interface{}{"fromSchemaHash": old.SchemaHash}})
		}
	}
	sort.Slice(changes, func(i, j int) bool {
		if changes[i].ToolName == changes[j].ToolName {
			return changes[i].Type < changes[j].Type
		}
		return changes[i].ToolName < changes[j].ToolName
	})
	return changes
}

func normalizeSnapshotItems(items []ToolSchemaSnapshotItem) []ToolSchemaSnapshotItem {
	out := make([]ToolSchemaSnapshotItem, len(items))
	for i, item := range items {
		out[i] = item
		if out[i].SchemaHash == "" {
			out[i].SchemaHash = schemaHash(out[i].InputSchema)
		}
	}
	return out
}

func normalizeListOptions(options ListOptions) ListOptions {
	if options.Limit <= 0 || options.Limit > 100 {
		options.Limit = 50
	}
	if options.Filters == nil {
		options.Filters = map[string]string{}
	}
	return options
}

func matchesServerFilters(server MCPServer, filters map[string]string) bool {
	checks := map[string]string{"environment": string(server.Environment), "risk_level": string(server.RiskLevel), "owner_team_id": server.OwnerTeamID, "transport": string(server.Transport), "category": string(server.Category), "trust_level": string(server.TrustLevel), "visibility": string(server.Visibility)}
	for key, actual := range checks {
		if expected := strings.TrimSpace(filters[key]); expected != "" && expected != actual {
			return false
		}
	}
	if tag := strings.TrimSpace(filters["tag"]); tag != "" && !containsString(server.Tags, tag) {
		return false
	}
	if method := strings.TrimSpace(filters["install_method"]); method != "" && !containsInstallMethod(server.InstallMethods, InstallMethod(method)) {
		return false
	}
	if enabled := strings.TrimSpace(filters["enabled"]); enabled != "" && enabled != fmt.Sprint(server.Enabled) {
		return false
	}
	if published := strings.TrimSpace(filters["published"]); published != "" && published != fmt.Sprint(server.Published) {
		return false
	}
	if query := strings.ToLower(strings.TrimSpace(filters["q"])); query != "" {
		text := strings.ToLower(strings.Join(append([]string{server.Slug, server.DisplayName, server.Description, server.Summary}, append(server.Tags, server.UseCases...)...), " "))
		if !strings.Contains(text, query) {
			return false
		}
	}
	return true
}

func paginateByID[T interface{ getID() string }](items []T, options ListOptions) ListResponse[T] {
	start := 0
	if options.Cursor != "" {
		for i, item := range items {
			if item.getID() == options.Cursor {
				start = i + 1
				break
			}
		}
	}
	end := start + options.Limit
	if end > len(items) {
		end = len(items)
	}
	pageItems := cloneSlice(items[start:end])
	page := &PageInfo{Limit: options.Limit}
	if end < len(items) && len(pageItems) > 0 {
		page.NextCursor = pageItems[len(pageItems)-1].getID()
	}
	return ListResponse[T]{Items: pageItems, PageInfo: page}
}

func paginateSchemaDiffs(items []SchemaDiff, options ListOptions) ListResponse[SchemaDiff] {
	start := 0
	if options.Cursor != "" {
		for i, item := range items {
			if item.ID == options.Cursor {
				start = i + 1
				break
			}
		}
	}
	end := start + options.Limit
	if end > len(items) {
		end = len(items)
	}
	pageItems := cloneSlice(items[start:end])
	page := &PageInfo{Limit: options.Limit}
	if end < len(items) && len(pageItems) > 0 {
		page.NextCursor = pageItems[len(pageItems)-1].ID
	}
	return ListResponse[SchemaDiff]{Items: pageItems, PageInfo: page}
}

func (s MCPServer) getID() string { return s.ID }

func schemaDiffStatus(changes []SchemaChange) string {
	if len(changes) == 0 {
		return "no_changes"
	}
	return "changes_detected"
}

func changesNeedApproval(changes []SchemaChange) bool {
	for _, change := range changes {
		if change.ApprovalRequired {
			return true
		}
	}
	return false
}

func schemaApprovalState(changes []SchemaChange) string {
	if changesNeedApproval(changes) {
		return "pending"
	}
	return "not_required"
}

func approvalState(required bool) string {
	if required {
		return "pending"
	}
	return "not_required"
}

func highRisk(risk RiskLevel) bool { return risk == RiskHigh || risk == RiskCritical }

func schemaHash(schema map[string]interface{}) string {
	encoded, _ := json.Marshal(schema)
	sum := sha256.Sum256(encoded)
	return hex.EncodeToString(sum[:])
}

func schemaHashFromToolsLocked(tools []MCPTool) string {
	items := make([]ToolSchemaSnapshotItem, 0, len(tools))
	for _, tool := range tools {
		items = append(items, ToolSchemaSnapshotItem{Name: tool.Name, Description: tool.Description, RiskLevel: tool.RiskLevel, InputSchema: cloneMap(tool.InputSchema), SchemaHash: schemaHash(tool.InputSchema)})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].Name < items[j].Name })
	encoded, _ := json.Marshal(items)
	sum := sha256.Sum256(encoded)
	return hex.EncodeToString(sum[:])
}

func cloneMap(in map[string]interface{}) map[string]interface{} {
	if in == nil {
		return nil
	}
	encoded, _ := json.Marshal(in)
	out := map[string]interface{}{}
	_ = json.Unmarshal(encoded, &out)
	return out
}

func objectMap(value interface{}) (map[string]interface{}, bool) {
	if value == nil {
		return nil, false
	}
	if out, ok := value.(map[string]interface{}); ok {
		return out, true
	}
	return nil, false
}

func validEnvironment(value Environment) bool {
	switch value {
	case EnvironmentDev, EnvironmentStg, EnvironmentProd, EnvironmentShared:
		return true
	default:
		return false
	}
}

func validTransport(value ServerTransport) bool {
	switch value {
	case TransportStreamableHTTP, TransportSSELegacy, TransportStdioAdapter, TransportExternal:
		return true
	default:
		return false
	}
}

func validRisk(value RiskLevel) bool {
	switch value {
	case RiskLow, RiskMedium, RiskHigh, RiskCritical:
		return true
	default:
		return false
	}
}

func validMarketCategory(value MarketCategory) bool {
	switch value {
	case MarketCategoryDeveloperTools, MarketCategoryAPIDevelopment, MarketCategoryDataDatabase, MarketCategoryCloudInfra, MarketCategoryObservability, MarketCategorySecurityTesting, MarketCategoryKnowledgeDocs, MarketCategoryProductivityWorkflow, MarketCategoryBrowserAutomation, MarketCategoryDesignTools, MarketCategoryOther:
		return true
	default:
		return false
	}
}

func validInstallMethod(value InstallMethod) bool {
	switch value {
	case InstallMethodRemoteHTTP, InstallMethodStdio, InstallMethodDocker, InstallMethodGateway:
		return true
	default:
		return false
	}
}

func validMarketTrustLevel(value MarketTrustLevel) bool {
	switch value {
	case MarketTrustCommunity, MarketTrustVerified, MarketTrustOfficial, MarketTrustPlatformSupported:
		return true
	default:
		return false
	}
}

func validMarketVisibility(value MarketVisibility) bool {
	switch value {
	case MarketVisibilityDraft, MarketVisibilityInternal, MarketVisibilityPublished, MarketVisibilityHidden, MarketVisibilityQuarantined:
		return true
	default:
		return false
	}
}

func validMarketMetadata(server MCPServer) bool {
	if !validMarketCategory(server.Category) || !validMarketTrustLevel(server.TrustLevel) || !validMarketVisibility(server.Visibility) {
		return false
	}
	for _, method := range server.InstallMethods {
		if !validInstallMethod(method) {
			return false
		}
	}
	if hasBlankString(server.Tags) || hasBlankString(server.UseCases) || hasBlankString(server.Prerequisites) || hasBlankString(server.SecurityNotes) {
		return false
	}
	return validOptionalURL(server.DocsURL) && validOptionalURL(server.SourceURL) && validOptionalURL(server.IconURL) && validOptionalTime(server.ReviewedAt) && validOptionalTime(server.PublishedAt)
}

func validOptionalURL(value string) bool {
	if strings.TrimSpace(value) == "" {
		return true
	}
	parsed, err := url.ParseRequestURI(value)
	return err == nil && parsed.Scheme != "" && parsed.Host != "" && (parsed.Scheme == "http" || parsed.Scheme == "https")
}

func hasBlankString(values []string) bool {
	for _, value := range values {
		if strings.TrimSpace(value) == "" {
			return true
		}
	}
	return false
}

func validOptionalTime(value string) bool {
	if strings.TrimSpace(value) == "" {
		return true
	}
	if _, err := time.Parse(time.RFC3339Nano, value); err == nil {
		return true
	}
	_, err := time.Parse(time.RFC3339, value)
	return err == nil
}

func containsInstallMethod(values []InstallMethod, target InstallMethod) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func firstNonEmptyString(value, fallback string) string {
	if strings.TrimSpace(value) != "" {
		return value
	}
	return fallback
}

func dedupeStrings(values []string) []string {
	seen := map[string]bool{}
	out := []string{}
	for _, value := range values {
		if strings.TrimSpace(value) == "" || seen[value] {
			continue
		}
		seen[value] = true
		out = append(out, value)
	}
	return out
}

func containsString(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func cloneStringMap(in map[string]string) map[string]string {
	out := map[string]string{}
	for key, value := range in {
		out[key] = value
	}
	return out
}

func matchesSecretBinding(binding SecretBinding, filters map[string]string) bool {
	if filters == nil {
		return true
	}
	checks := map[string]string{"scope_type": binding.ScopeType, "scope_id": binding.ScopeID, "provider": binding.Provider}
	for key, actual := range checks {
		if expected := strings.TrimSpace(filters[key]); expected != "" && expected != actual {
			return false
		}
	}
	return true
}

func gitOpsMetadata(version MCPServerVersion) map[string]string {
	metadata := map[string]string{}
	if version.GitOpsRepo != "" {
		metadata["repo"] = version.GitOpsRepo
	}
	if version.GitOpsPath != "" {
		metadata["path"] = version.GitOpsPath
	}
	if version.GitOpsRevision != "" {
		metadata["revision"] = version.GitOpsRevision
	}
	return metadata
}

func filterSlice[T any](items []T, keep func(T) bool) []T {
	out := make([]T, 0, len(items))
	for _, item := range items {
		if keep(item) {
			out = append(out, item)
		}
	}
	return out
}

func validSecretRef(provider, ref string) bool {
	provider = strings.ToLower(strings.TrimSpace(provider))
	ref = strings.TrimSpace(ref)
	if provider == "" || ref == "" || strings.ContainsAny(ref, " \t\n\r") {
		return false
	}
	lower := strings.ToLower(ref)
	allowedPrefixesByProvider := map[string][]string{
		"vault":              {"vault://"},
		"aws-sm":             {"aws-sm://", "aws-secretsmanager://"},
		"aws-secretsmanager": {"aws-secretsmanager://"},
		"gcp-secretmanager":  {"gcp-secretmanager://"},
		"azure-keyvault":     {"azure-keyvault://"},
		"kubernetes":         {"kubernetes://"},
		"external-secret":    {"external-secret://"},
		"secretref":          {"secretref://"},
		"secret-store":       {"secret://", "secretref://"},
		"external":           {"vault://", "aws-sm://", "aws-secretsmanager://", "gcp-secretmanager://", "azure-keyvault://", "kubernetes://", "external-secret://", "secretref://", "secret://"},
	}
	allowedPrefixes, ok := allowedPrefixesByProvider[provider]
	if !ok {
		return false
	}
	for _, prefix := range allowedPrefixes {
		if strings.HasPrefix(lower, prefix) && len(ref) > len(prefix) {
			return true
		}
	}
	return false
}

func redactedRefHash(ref string) string { return schemaHash(map[string]interface{}{"ref": ref}) }

func (s *Store) backfillSeedDataLocked() {
	now := Now()
	if s.userIndexLocked(AdminUserID) < 0 {
		s.users = append(s.users, User{ID: AdminUserID, Email: "admin@example.com", DisplayName: "Admin User", Admin: true, CreatedAt: now})
	}
	if s.teamIndexLocked(PlatformTeamID) < 0 {
		s.teams = append(s.teams, Team{ID: PlatformTeamID, Slug: "platform", DisplayName: "Platform Team", CreatedAt: now})
	}
	if !hasTeamMembership(s.teamMembers, PlatformTeamID, AdminUserID) {
		s.teamMembers = append(s.teamMembers, TeamMembership{TeamID: PlatformTeamID, UserID: AdminUserID, Role: "admin", CreatedAt: now})
	}
	if s.projectIndexLocked(SampleProjectID) < 0 {
		s.projects = append(s.projects, Project{ID: SampleProjectID, Slug: "sample", DisplayName: "Sample Project", OwnerTeamID: PlatformTeamID, Environment: EnvironmentDev, CreatedAt: now})
	}
	if !hasProjectMembership(s.projectMembers, SampleProjectID, SubjectTeam, PlatformTeamID) {
		s.projectMembers = append(s.projectMembers, ProjectMembership{ProjectID: SampleProjectID, SubjectType: SubjectTeam, SubjectID: PlatformTeamID, Role: "admin", CreatedAt: now})
	}
	if len(s.schemaSnapshots) == 0 && s.serverIndexLocked(K8sReadonlyID) >= 0 {
		s.recordSchemaSnapshotLocked(K8sReadonlyID, "backfill")
	}
	if idx := s.serverIndexLocked(K8sReadonlyID); idx >= 0 && s.servers[idx].Category == MarketCategoryOther && len(s.servers[idx].Tags) == 0 {
		applyK8sReadonlyMarketMetadata(&s.servers[idx], now)
	}
}

func hasTeamMembership(items []TeamMembership, teamID, userID string) bool {
	for _, item := range items {
		if item.TeamID == teamID && item.UserID == userID {
			return true
		}
	}
	return false
}

func hasProjectMembership(items []ProjectMembership, projectID string, subjectType GrantSubjectType, subjectID string) bool {
	for _, item := range items {
		if item.ProjectID == projectID && item.SubjectType == subjectType && item.SubjectID == subjectID {
			return true
		}
	}
	return false
}

func (s *Store) userIndexLocked(id string) int {
	for i, user := range s.users {
		if user.ID == id {
			return i
		}
	}
	return -1
}

func (s *Store) teamIndexLocked(id string) int {
	for i, team := range s.teams {
		if team.ID == id {
			return i
		}
	}
	return -1
}

func (s *Store) projectIndexLocked(id string) int {
	for i, project := range s.projects {
		if project.ID == id {
			return i
		}
	}
	return -1
}

func (s *Store) getServerBySlugLocked(slug string) (MCPServer, error) {
	for _, server := range s.servers {
		if server.Slug == slug {
			return server, nil
		}
	}
	return MCPServer{}, ErrNotFound
}

func (s *Store) toolIndexByIDOrNameLocked(serverID, toolID, toolName string) int {
	for i, tool := range s.tools {
		if serverID != "" && tool.ServerID != serverID {
			continue
		}
		if toolID != "" && tool.ID == toolID {
			return i
		}
		if toolName != "" && tool.Name == toolName {
			return i
		}
	}
	return -1
}
