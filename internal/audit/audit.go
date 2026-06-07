package audit

import "github.com/mcp-hub/mcp-hub/internal/db"

func NewEvent(eventType string, principal db.AuthContext, traceID string, serverID string, toolName string, risk db.RiskLevel, decision db.PolicyEffect) db.AuditEvent {
	teamID := ""
	if len(principal.TeamIDs) > 0 {
		teamID = principal.TeamIDs[0]
	}
	return db.AuditEvent{ID: db.NewID(), Timestamp: db.Now(), UserID: principal.UserID, TeamID: teamID, ProjectID: principal.ProjectID, ClientID: principal.ClientID, ServerID: serverID, ToolName: toolName, EventType: eventType, RiskLevel: risk, PolicyDecision: decision, TraceID: traceID, MetadataJSON: map[string]interface{}{"source": "go-core"}}
}
