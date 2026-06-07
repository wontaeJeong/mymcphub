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

func TestValidateDocumentRejectsUnsafeHighRiskAllow(t *testing.T) {
	decision := ValidateDocument(map[string]interface{}{"rules": []interface{}{map[string]interface{}{
		"effect":     "allow",
		"reasonCode": "ALLOW_CRITICAL",
		"riskLevels": []interface{}{string(db.RiskCritical)},
	}}})
	if decision.Allowed || decision.ReasonCode != "POLICY_VALIDATION_FAILED" {
		t.Fatalf("expected validation deny, got %#v", decision)
	}
}

func TestSimulateDocumentMatchesDenyRule(t *testing.T) {
	decision := SimulateDocument(map[string]interface{}{
		"rules": []interface{}{map[string]interface{}{
			"effect":     "deny",
			"reasonCode": "DENY_EXEC",
			"reason":     "Exec tools are not allowed.",
			"toolNames":  []interface{}{"exec"},
		}},
		"context": map[string]interface{}{"toolName": "exec"},
	})
	if decision.Allowed || decision.ReasonCode != "DENY_EXEC" {
		t.Fatalf("expected deny rule match, got %#v", decision)
	}
}

func TestSimulateDocumentDefaultsToDeny(t *testing.T) {
	decision := SimulateDocument(map[string]interface{}{
		"rules": []interface{}{map[string]interface{}{
			"effect":           "allow",
			"reasonCode":       "ALLOW_MEDIUM",
			"riskLevels":       []interface{}{string(db.RiskMedium)},
			"requiresApproval": false,
		}},
		"context": map[string]interface{}{"riskLevel": string(db.RiskLow)},
	})
	if decision.Allowed || decision.ReasonCode != "DENY_BY_DEFAULT" {
		t.Fatalf("expected default deny, got %#v", decision)
	}
}
