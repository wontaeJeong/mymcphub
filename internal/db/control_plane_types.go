package db

type User struct {
	ID          string `json:"id"`
	Email       string `json:"email"`
	DisplayName string `json:"displayName"`
	Admin       bool   `json:"admin"`
	CreatedAt   string `json:"createdAt"`
}

type Team struct {
	ID          string `json:"id"`
	Slug        string `json:"slug"`
	DisplayName string `json:"displayName"`
	CreatedAt   string `json:"createdAt"`
}

type TeamMembership struct {
	TeamID    string `json:"teamId"`
	UserID    string `json:"userId"`
	Role      string `json:"role"`
	CreatedAt string `json:"createdAt"`
}

type Project struct {
	ID          string      `json:"id"`
	Slug        string      `json:"slug"`
	DisplayName string      `json:"displayName"`
	OwnerTeamID string      `json:"ownerTeamId"`
	Environment Environment `json:"environment"`
	CreatedAt   string      `json:"createdAt"`
}

type ProjectMembership struct {
	ProjectID   string           `json:"projectId"`
	SubjectType GrantSubjectType `json:"subjectType"`
	SubjectID   string           `json:"subjectId"`
	Role        string           `json:"role"`
	CreatedAt   string           `json:"createdAt"`
}

type PolicyInput struct {
	Principal          AuthContext         `json:"principal"`
	Project            Project             `json:"project"`
	Teams              []Team              `json:"teams"`
	TeamMemberships    []TeamMembership    `json:"teamMemberships"`
	ProjectMemberships []ProjectMembership `json:"projectMemberships"`
}

type SecretBinding struct {
	ID             string `json:"id"`
	ScopeType      string `json:"scopeType"`
	ScopeID        string `json:"scopeId"`
	Provider       string `json:"provider"`
	Ref            string `json:"ref"`
	Description    string `json:"description,omitempty"`
	LeaseExpiresAt string `json:"leaseExpiresAt,omitempty"`
	LeaseRenewable bool   `json:"leaseRenewable"`
	LastRotatedAt  string `json:"lastRotatedAt,omitempty"`
	CreatedAt      string `json:"createdAt"`
	UpdatedAt      string `json:"updatedAt"`
}

type ToolSchemaSnapshot struct {
	ID        string                   `json:"id"`
	ServerID  string                   `json:"serverId"`
	VersionID string                   `json:"versionId,omitempty"`
	Source    string                   `json:"source"`
	Tools     []ToolSchemaSnapshotItem `json:"tools"`
	CreatedAt string                   `json:"createdAt"`
}

type ToolSchemaSnapshotItem struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description,omitempty"`
	RiskLevel   RiskLevel              `json:"riskLevel"`
	InputSchema map[string]interface{} `json:"inputSchema,omitempty"`
	SchemaHash  string                 `json:"schemaHash"`
}

type SchemaChange struct {
	Type             string                 `json:"type"`
	ToolName         string                 `json:"toolName"`
	FromRiskLevel    RiskLevel              `json:"fromRiskLevel,omitempty"`
	ToRiskLevel      RiskLevel              `json:"toRiskLevel,omitempty"`
	ApprovalRequired bool                   `json:"approvalRequired"`
	ApprovalState    string                 `json:"approvalState"`
	Details          map[string]interface{} `json:"details,omitempty"`
}

type RolloutStatus struct {
	ServerID        string             `json:"serverId"`
	ActiveVersion   *MCPServerVersion  `json:"activeVersion,omitempty"`
	PendingVersions []MCPServerVersion `json:"pendingVersions"`
	RollbackTargets []MCPServerVersion `json:"rollbackTargets"`
	GitOpsMetadata  map[string]string  `json:"gitOpsMetadata"`
	UpdatedAt       string             `json:"updatedAt"`
}

type KillSwitchRequest struct {
	Reason       string `json:"reason"`
	Global       bool   `json:"global"`
	HighCritical bool   `json:"highCritical"`
	ServerID     string `json:"serverId,omitempty"`
	ServerSlug   string `json:"serverSlug,omitempty"`
	ToolID       string `json:"toolId,omitempty"`
	ToolName     string `json:"toolName,omitempty"`
	RevokeGrants bool   `json:"revokeGrants"`
}

type KillSwitchResult struct {
	EmergencyDeny EmergencyDeny          `json:"emergencyDeny"`
	Server        *MCPServer             `json:"server,omitempty"`
	Tool          *MCPTool               `json:"tool,omitempty"`
	RevokedGrants int                    `json:"revokedGrants"`
	Actions       []string               `json:"actions"`
	Metadata      map[string]interface{} `json:"metadata"`
}

type AuditExportJob struct {
	ID          string            `json:"id"`
	Status      string            `json:"status"`
	Format      string            `json:"format"`
	Filters     map[string]string `json:"filters"`
	RequestedBy string            `json:"requestedBy"`
	RequestedAt string            `json:"requestedAt"`
}

type ListOptions struct {
	Limit   int
	Cursor  string
	Filters map[string]string
}
