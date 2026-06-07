package db

type Environment string

const (
	EnvironmentDev    Environment = "dev"
	EnvironmentStg    Environment = "stg"
	EnvironmentProd   Environment = "prod"
	EnvironmentShared Environment = "shared"
)

type RiskLevel string

const (
	RiskLow      RiskLevel = "low"
	RiskMedium   RiskLevel = "medium"
	RiskHigh     RiskLevel = "high"
	RiskCritical RiskLevel = "critical"
)

type ServerTransport string

const (
	TransportStreamableHTTP ServerTransport = "streamable_http"
	TransportSSELegacy      ServerTransport = "sse_legacy"
	TransportStdioAdapter   ServerTransport = "stdio_adapter"
	TransportExternal       ServerTransport = "external"
)

type PolicyEffect string

const (
	PolicyAllow         PolicyEffect = "allow"
	PolicyDeny          PolicyEffect = "deny"
	PolicyNeedsApproval PolicyEffect = "needs_approval"
)

type GrantSubjectType string

const (
	SubjectUser           GrantSubjectType = "user"
	SubjectTeam           GrantSubjectType = "team"
	SubjectServiceAccount GrantSubjectType = "service_account"
)

type AuthContext struct {
	UserID          string           `json:"userId"`
	PrincipalType   GrantSubjectType `json:"principalType"`
	Email           string           `json:"email"`
	DisplayName     string           `json:"displayName"`
	TeamIDs         []string         `json:"teamIds"`
	Teams           []string         `json:"teams"`
	Groups          []string         `json:"groups"`
	Roles           []string         `json:"roles"`
	ClientID        string           `json:"clientId"`
	Issuer          string           `json:"issuer"`
	Audience        string           `json:"audience"`
	RedirectURI     string           `json:"redirectUri,omitempty"`
	IsAdmin         bool             `json:"isAdmin"`
	IsPlatformAdmin bool             `json:"isPlatformAdmin"`
	AuthSource      string           `json:"authSource"`
	TokenIssuer     string           `json:"tokenIssuer"`
	ProjectID       string           `json:"-"`
}

type OAuthClient struct {
	ID           string   `json:"id"`
	ClientID     string   `json:"clientId"`
	DisplayName  string   `json:"displayName"`
	OwnerTeamID  string   `json:"ownerTeamId"`
	RedirectURIs []string `json:"redirectUris"`
	DCRAllowed   bool     `json:"dcrAllowed"`
	Enabled      bool     `json:"enabled"`
	CreatedAt    string   `json:"createdAt"`
}

type MCPServer struct {
	ID          string          `json:"id"`
	Slug        string          `json:"slug"`
	DisplayName string          `json:"displayName"`
	Description string          `json:"description,omitempty"`
	OwnerTeamID string          `json:"ownerTeamId"`
	Environment Environment     `json:"environment"`
	Transport   ServerTransport `json:"transport"`
	UpstreamURL string          `json:"upstreamUrl,omitempty"`
	TimeoutMS   int             `json:"timeoutMs,omitempty"`
	Enabled     bool            `json:"enabled"`
	Published   bool            `json:"published"`
	Quarantined bool            `json:"quarantined"`
	RiskLevel   RiskLevel       `json:"riskLevel"`
	CreatedAt   string          `json:"createdAt"`
	UpdatedAt   string          `json:"updatedAt"`
}

type MCPTool struct {
	ID           string                 `json:"id"`
	ServerID     string                 `json:"serverId"`
	Name         string                 `json:"name"`
	Description  string                 `json:"description,omitempty"`
	Enabled      bool                   `json:"enabled"`
	RiskLevel    RiskLevel              `json:"riskLevel"`
	InputSchema  map[string]interface{} `json:"inputSchema,omitempty"`
	DiscoveredAt string                 `json:"discoveredAt"`
	LastSeenAt   string                 `json:"lastSeenAt,omitempty"`
}

type MCPServerVersion struct {
	ID              string                 `json:"id"`
	ServerID        string                 `json:"serverId"`
	Version         string                 `json:"version"`
	Status          string                 `json:"status"`
	RolloutStatus   string                 `json:"rolloutStatus,omitempty"`
	RolloutMessage  string                 `json:"rolloutMessage,omitempty"`
	ImageRef        string                 `json:"imageRef,omitempty"`
	ImageRepository string                 `json:"imageRepository,omitempty"`
	ImageTag        string                 `json:"imageTag,omitempty"`
	ImageDigest     string                 `json:"imageDigest,omitempty"`
	ConfigHash      string                 `json:"configHash,omitempty"`
	ToolSchemaHash  string                 `json:"toolSchemaHash,omitempty"`
	GitOpsRepo      string                 `json:"gitOpsRepo,omitempty"`
	GitOpsPath      string                 `json:"gitOpsPath,omitempty"`
	GitOpsRevision  string                 `json:"gitOpsRevision,omitempty"`
	CreatedBy       string                 `json:"createdBy,omitempty"`
	CreatedAt       string                 `json:"createdAt"`
	UpdatedAt       string                 `json:"updatedAt"`
	ActivatedAt     string                 `json:"activatedAt,omitempty"`
	RolledBackAt    string                 `json:"rolledBackAt,omitempty"`
	ManifestJSON    map[string]interface{} `json:"manifestJson,omitempty"`
}

type Grant struct {
	ID           string           `json:"id"`
	SubjectType  GrantSubjectType `json:"subjectType"`
	SubjectID    string           `json:"subjectId"`
	ProjectID    string           `json:"projectId"`
	ServerID     string           `json:"serverId"`
	AllowedTools []string         `json:"allowedTools"`
	Environment  Environment      `json:"environment"`
	ExpiresAt    string           `json:"expiresAt,omitempty"`
	ApprovedBy   string           `json:"approvedBy,omitempty"`
	Reason       string           `json:"reason"`
	TicketURL    string           `json:"ticketUrl,omitempty"`
	Enabled      bool             `json:"enabled"`
	CreatedAt    string           `json:"createdAt"`
}

type Approval struct {
	ID                 string           `json:"id"`
	RequesterID        string           `json:"requesterId"`
	SubjectType        GrantSubjectType `json:"subjectType"`
	SubjectID          string           `json:"subjectId"`
	ProjectID          string           `json:"projectId"`
	ServerID           string           `json:"serverId"`
	RequestedTools     []string         `json:"requestedTools"`
	Environment        Environment      `json:"environment"`
	ToolName           string           `json:"toolName,omitempty"`
	Status             string           `json:"status"`
	RequestedAction    string           `json:"requestedAction"`
	Reason             string           `json:"reason"`
	TicketURL          string           `json:"ticketUrl,omitempty"`
	RequestedExpiresAt string           `json:"requestedExpiresAt,omitempty"`
	ReviewerID         string           `json:"reviewerId,omitempty"`
	ReviewComment      string           `json:"reviewComment,omitempty"`
	DecidedBy          string           `json:"decidedBy,omitempty"`
	DecidedAt          string           `json:"decidedAt,omitempty"`
	CreatedAt          string           `json:"createdAt"`
	UpdatedAt          string           `json:"updatedAt"`
}

type AuditEvent struct {
	ID                   string                 `json:"id"`
	Timestamp            string                 `json:"timestamp"`
	UserID               string                 `json:"userId,omitempty"`
	TeamID               string                 `json:"teamId,omitempty"`
	ProjectID            string                 `json:"projectId,omitempty"`
	ClientID             string                 `json:"clientId,omitempty"`
	SessionID            string                 `json:"sessionId,omitempty"`
	ServerID             string                 `json:"serverId,omitempty"`
	ToolName             string                 `json:"toolName,omitempty"`
	EventType            string                 `json:"eventType"`
	RiskLevel            RiskLevel              `json:"riskLevel"`
	PolicyDecision       PolicyEffect           `json:"policyDecision"`
	TraceID              string                 `json:"traceId"`
	ArgumentHash         string                 `json:"argumentHash,omitempty"`
	ArgumentRedactedJSON interface{}            `json:"argumentRedactedJson,omitempty"`
	LatencyMS            int                    `json:"latencyMs,omitempty"`
	UpstreamStatus       int                    `json:"upstreamStatus,omitempty"`
	ErrorCode            string                 `json:"errorCode,omitempty"`
	MetadataJSON         map[string]interface{} `json:"metadataJson"`
}

type ToolCallEvent struct {
	ID           string `json:"id"`
	AuditEventID string `json:"auditEventId"`
	ServerID     string `json:"serverId"`
	ToolName     string `json:"toolName"`
	Status       string `json:"status"`
	LatencyMS    int    `json:"latencyMs,omitempty"`
	CreatedAt    string `json:"createdAt"`
}

type RateLimitBucket struct {
	Key     string `json:"key"`
	Count   int    `json:"count"`
	ResetAt string `json:"resetAt"`
}

type ServerHealth struct {
	ID           string `json:"id"`
	ServerID     string `json:"serverId"`
	Status       string `json:"status"`
	LatencyMS    int    `json:"latencyMs,omitempty"`
	ErrorMessage string `json:"errorMessage,omitempty"`
	CheckedAt    string `json:"checkedAt"`
}

type RuntimeStatus struct {
	ID               string                   `json:"id"`
	ServerID         string                   `json:"serverId,omitempty"`
	ServerSlug       string                   `json:"serverSlug"`
	ManifestHash     string                   `json:"manifestHash"`
	Phase            string                   `json:"phase"`
	Namespace        string                   `json:"namespace"`
	ResourceKinds    []string                 `json:"resourceKinds"`
	ResourceCount    int                      `json:"resourceCount"`
	RenderedObjects  []map[string]interface{} `json:"renderedObjects"`
	Warnings         []string                 `json:"warnings,omitempty"`
	LastReconciledAt string                   `json:"lastReconciledAt"`
	UpdatedAt        string                   `json:"updatedAt"`
}

type SecretLease struct {
	ID                   string `json:"id"`
	ServerID             string `json:"serverId,omitempty"`
	ServerSlug           string `json:"serverSlug"`
	SecretRef            string `json:"secretRef"`
	TargetEnv            string `json:"targetEnv"`
	Status               string `json:"status"`
	IssuedAt             string `json:"issuedAt"`
	ExpiresAt            string `json:"expiresAt"`
	RevokedAt            string `json:"revokedAt,omitempty"`
	LeaseDurationSeconds int    `json:"leaseDurationSeconds"`
}

type EmergencyDeny struct {
	Enabled      bool     `json:"enabled"`
	Reason       string   `json:"reason"`
	Global       bool     `json:"global"`
	HighCritical bool     `json:"highCritical"`
	ServerIDs    []string `json:"serverIds"`
	ServerSlugs  []string `json:"serverSlugs"`
	ToolNames    []string `json:"toolNames"`
	SubjectIDs   []string `json:"subjectIds"`
	ClientIDs    []string `json:"clientIds"`
	CreatedAt    string   `json:"createdAt"`
}

type SchemaDiff struct {
	ID               string         `json:"id,omitempty"`
	ServerID         string         `json:"serverId"`
	FromVersionID    string         `json:"fromVersionId,omitempty"`
	ToVersionID      string         `json:"toVersionId,omitempty"`
	FromSnapshotID   string         `json:"fromSnapshotId,omitempty"`
	ToSnapshotID     string         `json:"toSnapshotId,omitempty"`
	Status           string         `json:"status"`
	ApprovalRequired bool           `json:"approvalRequired"`
	ApprovalState    string         `json:"approvalState"`
	GeneratedAt      string         `json:"generatedAt"`
	Changes          []SchemaChange `json:"changes"`
}

type ListResponse[T any] struct {
	Items    []T       `json:"items"`
	PageInfo *PageInfo `json:"pageInfo,omitempty"`
}

type PageInfo struct {
	Limit      int    `json:"limit"`
	NextCursor string `json:"nextCursor,omitempty"`
}
