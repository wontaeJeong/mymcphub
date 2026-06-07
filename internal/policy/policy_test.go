package policy

import (
	"testing"

	"github.com/mcp-hub/mcp-hub/internal/db"
)

func TestEvaluateConnectRequiresMatchingProjectGrant(t *testing.T) {
	server := db.MCPServer{ID: "server-1", Environment: db.EnvironmentDev, Enabled: true}
	principal := db.AuthContext{UserID: db.AdminUserID, TeamIDs: []string{db.PlatformTeamID}, ProjectID: "project-b"}
	grants := []db.Grant{{ID: "grant-a", SubjectType: db.SubjectTeam, SubjectID: db.PlatformTeamID, ProjectID: "project-a", ServerID: server.ID, Environment: db.EnvironmentDev, AllowedTools: []string{"*"}, Enabled: true}}
	decision := EvaluateConnect(principal, server, grants, nil)
	if decision.Allowed || decision.ReasonCode != "CONNECT_GRANT_REQUIRED" {
		t.Fatalf("expected cross-project grant to be denied, got %#v", decision)
	}
}
