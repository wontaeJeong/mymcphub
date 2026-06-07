package policy

import (
	"strings"
	"time"

	"github.com/mcp-hub/mcp-hub/internal/db"
)

type Decision struct {
	Effect                db.PolicyEffect `json:"effect"`
	Allowed               bool            `json:"allowed"`
	Reason                string          `json:"reason"`
	ReasonCode            string          `json:"reasonCode"`
	MatchedGrantIDs       []string        `json:"matchedGrantIds"`
	RequiresApproval      bool            `json:"requiresApproval"`
	RequiresStepUp        bool            `json:"requiresStepUp"`
	DiscoverableToolNames []string        `json:"discoverableToolNames,omitempty"`
}

func Allow(reason string, grantIDs []string) Decision {
	return Decision{Effect: db.PolicyAllow, Allowed: true, Reason: reason, ReasonCode: "ALLOW", MatchedGrantIDs: grantIDs}
}
func Deny(code, reason string) Decision {
	return Decision{Effect: db.PolicyDeny, Allowed: false, Reason: reason, ReasonCode: code, MatchedGrantIDs: []string{}}
}

func EvaluateConnect(principal db.AuthContext, server db.MCPServer, grants []db.Grant, emergency *db.EmergencyDeny) Decision {
	if emergencyDecision := evaluateEmergency(principal, server, "", db.RiskLow, emergency); emergencyDecision != nil {
		return *emergencyDecision
	}
	if !server.Enabled || server.Quarantined {
		return Deny("SERVER_DISABLED", "Server is disabled or quarantined.")
	}
	matched := activeGrants(principal, server, grants)
	if len(matched) == 0 {
		return Deny("CONNECT_GRANT_REQUIRED", "No active grant permits connecting to this server.")
	}
	return Allow("Principal may connect to server.", grantIDs(matched))
}

func EvaluateDiscovery(principal db.AuthContext, server db.MCPServer, tools []db.MCPTool, grants []db.Grant, emergency *db.EmergencyDeny) Decision {
	connect := EvaluateConnect(principal, server, grants, emergency)
	if !connect.Allowed {
		return connect
	}
	matched := activeGrants(principal, server, grants)
	allowed := make([]string, 0, len(tools))
	for _, tool := range tools {
		if tool.Enabled && grantsAllowTool(matched, tool.Name) {
			allowed = append(allowed, tool.Name)
		}
	}
	decision := Allow("Principal may discover granted tools.", grantIDs(matched))
	decision.DiscoverableToolNames = allowed
	return decision
}

func EvaluateToolCall(principal db.AuthContext, server db.MCPServer, tool db.MCPTool, grants []db.Grant, emergency *db.EmergencyDeny, stepUp bool) Decision {
	if emergencyDecision := evaluateEmergency(principal, server, tool.Name, tool.RiskLevel, emergency); emergencyDecision != nil {
		return *emergencyDecision
	}
	if !server.Enabled || server.Quarantined {
		return Deny("SERVER_DISABLED", "Server is disabled or quarantined.")
	}
	if !tool.Enabled || tool.Name == "" {
		return Deny("TOOL_DISABLED", "Tool is disabled or not registered.")
	}
	matched := activeGrants(principal, server, grants)
	toolGrants := make([]db.Grant, 0, len(matched))
	for _, grant := range matched {
		if grantAllowsTool(grant, tool.Name) {
			toolGrants = append(toolGrants, grant)
		}
	}
	if len(toolGrants) == 0 {
		return Deny("TOOL_GRANT_REQUIRED", "Tool is not granted for this principal.")
	}
	if tool.RiskLevel == db.RiskHigh || tool.RiskLevel == db.RiskCritical {
		explicitApproved := false
		for _, grant := range toolGrants {
			if containsString(grant.AllowedTools, tool.Name) && grant.ApprovedBy != "" {
				explicitApproved = true
			}
		}
		if !explicitApproved {
			return Decision{Effect: db.PolicyNeedsApproval, Allowed: false, Reason: "High and critical risk tools require explicit approved grants.", ReasonCode: "APPROVAL_REQUIRED", MatchedGrantIDs: grantIDs(toolGrants), RequiresApproval: true, RequiresStepUp: tool.RiskLevel == db.RiskCritical}
		}
		if tool.RiskLevel == db.RiskCritical && !stepUp {
			return Decision{Effect: db.PolicyNeedsApproval, Allowed: false, Reason: "Critical-risk tools require step-up confirmation.", ReasonCode: "STEP_UP_REQUIRED", MatchedGrantIDs: grantIDs(toolGrants), RequiresStepUp: true}
		}
	}
	return Allow("Tool is granted for this principal.", grantIDs(toolGrants))
}

func activeGrants(principal db.AuthContext, server db.MCPServer, grants []db.Grant) []db.Grant {
	now := time.Now().UTC()
	out := make([]db.Grant, 0, len(grants))
	for _, grant := range grants {
		if !grant.Enabled || grant.ServerID != server.ID || grant.ProjectID != principal.ProjectID || grant.Environment != server.Environment || !grantMatchesPrincipal(principal, grant) {
			continue
		}
		if grant.ExpiresAt != "" {
			expires, err := time.Parse(time.RFC3339, grant.ExpiresAt)
			if err != nil || expires.Before(now) {
				continue
			}
		}
		out = append(out, grant)
	}
	return out
}

func evaluateEmergency(principal db.AuthContext, server db.MCPServer, toolName string, risk db.RiskLevel, emergency *db.EmergencyDeny) *Decision {
	if emergency == nil || !emergency.Enabled {
		return nil
	}
	if emergency.Global || len(emergency.ServerIDs)+len(emergency.ServerSlugs)+len(emergency.ToolNames)+len(emergency.SubjectIDs)+len(emergency.ClientIDs) == 0 {
		decision := Deny("EMERGENCY_DENY", emergency.Reason)
		return &decision
	}
	if emergency.HighCritical && (risk == db.RiskHigh || risk == db.RiskCritical) {
		decision := Deny("EMERGENCY_DENY", emergency.Reason)
		return &decision
	}
	if containsString(emergency.ServerIDs, server.ID) || containsString(emergency.ServerSlugs, server.Slug) || containsString(emergency.ToolNames, toolName) || containsString(emergency.SubjectIDs, principal.UserID) || containsString(emergency.ClientIDs, principal.ClientID) {
		decision := Deny("EMERGENCY_DENY", emergency.Reason)
		return &decision
	}
	return nil
}

func grantMatchesPrincipal(principal db.AuthContext, grant db.Grant) bool {
	switch grant.SubjectType {
	case db.SubjectUser:
		return grant.SubjectID == principal.UserID
	case db.SubjectTeam:
		return containsString(principal.TeamIDs, grant.SubjectID) || containsString(principal.Teams, grant.SubjectID)
	case db.SubjectServiceAccount:
		return grant.SubjectID == principal.UserID && principal.PrincipalType == db.SubjectServiceAccount
	default:
		return false
	}
}
func grantsAllowTool(grants []db.Grant, toolName string) bool {
	for _, grant := range grants {
		if grantAllowsTool(grant, toolName) {
			return true
		}
	}
	return false
}
func grantAllowsTool(grant db.Grant, toolName string) bool {
	return containsString(grant.AllowedTools, "*") || containsString(grant.AllowedTools, toolName)
}
func grantIDs(grants []db.Grant) []string {
	ids := make([]string, 0, len(grants))
	for _, grant := range grants {
		ids = append(ids, grant.ID)
	}
	return ids
}
func containsString(values []string, target string) bool {
	if target == "" {
		return false
	}
	for _, value := range values {
		if strings.EqualFold(value, target) {
			return true
		}
	}
	return false
}

func ValidateDocument(input map[string]interface{}) Decision {
	rules, ok := input["rules"].([]interface{})
	if !ok || len(rules) == 0 {
		return Deny("POLICY_VALIDATION_FAILED", "Policy document requires a non-empty rules array.")
	}
	for _, rawRule := range rules {
		rule, ok := rawRule.(map[string]interface{})
		if !ok {
			return Deny("POLICY_VALIDATION_FAILED", "Each policy rule must be an object.")
		}
		effect, _ := rule["effect"].(string)
		if effect != string(db.PolicyAllow) && effect != string(db.PolicyDeny) && effect != string(db.PolicyNeedsApproval) {
			return Deny("POLICY_VALIDATION_FAILED", "Policy rule effect must be allow, deny, or needs_approval.")
		}
		if reasonCode, _ := rule["reasonCode"].(string); strings.TrimSpace(reasonCode) == "" {
			return Deny("POLICY_VALIDATION_FAILED", "Policy rule reasonCode is required.")
		}
		if !ruleHasSelector(rule) {
			return Deny("POLICY_VALIDATION_FAILED", "Policy rule must select at least one server, tool, subject, client, environment, or risk level.")
		}
		if effect == string(db.PolicyAllow) && ruleSelectsHighRisk(rule) && rule["requiresApproval"] != true {
			return Deny("POLICY_VALIDATION_FAILED", "Allow rules for high or critical risk levels must set requiresApproval true.")
		}
	}
	return Allow("Policy document is syntactically valid for the Go control plane.", []string{})
}

func SimulateDocument(input map[string]interface{}) Decision {
	if validation := ValidateDocument(input); !validation.Allowed {
		return validation
	}
	context, _ := input["context"].(map[string]interface{})
	rules, _ := input["rules"].([]interface{})
	for _, rawRule := range rules {
		rule, _ := rawRule.(map[string]interface{})
		if ruleMatches(rule, context) {
			reasonCode, _ := rule["reasonCode"].(string)
			reason, _ := rule["reason"].(string)
			if strings.TrimSpace(reason) == "" {
				reason = "Policy-as-code rule matched the simulation context."
			}
			switch rule["effect"] {
			case string(db.PolicyAllow):
				return Allow(reason, []string{})
			case string(db.PolicyNeedsApproval):
				return Decision{Effect: db.PolicyNeedsApproval, Allowed: false, Reason: reason, ReasonCode: reasonCode, MatchedGrantIDs: []string{}, RequiresApproval: true}
			default:
				return Deny(reasonCode, reason)
			}
		}
	}
	return Deny("DENY_BY_DEFAULT", "No policy-as-code rule matched the simulation context.")
}

func ruleHasSelector(rule map[string]interface{}) bool {
	for _, key := range []string{"serverIds", "serverSlugs", "toolNames", "subjectIds", "clientIds", "environments", "riskLevels"} {
		if values, ok := policyStringSlice(rule[key]); ok && len(values) > 0 {
			return true
		}
	}
	return false
}

func ruleSelectsHighRisk(rule map[string]interface{}) bool {
	values, ok := policyStringSlice(rule["riskLevels"])
	if !ok {
		return false
	}
	return containsString(values, string(db.RiskHigh)) || containsString(values, string(db.RiskCritical))
}

func ruleMatches(rule, context map[string]interface{}) bool {
	checks := map[string]string{
		"serverIds":    textValue(context["serverId"]),
		"serverSlugs":  textValue(context["serverSlug"]),
		"toolNames":    textValue(context["toolName"]),
		"subjectIds":   textValue(context["subjectId"]),
		"clientIds":    textValue(context["clientId"]),
		"environments": textValue(context["environment"]),
		"riskLevels":   textValue(context["riskLevel"]),
	}
	matchedAny := false
	for key, actual := range checks {
		values, ok := policyStringSlice(rule[key])
		if !ok || len(values) == 0 {
			continue
		}
		matchedAny = true
		if !containsString(values, actual) {
			return false
		}
	}
	return matchedAny
}

func policyStringSlice(value interface{}) ([]string, bool) {
	switch typed := value.(type) {
	case []string:
		return typed, true
	case []interface{}:
		out := make([]string, 0, len(typed))
		for _, item := range typed {
			text, ok := item.(string)
			if !ok || strings.TrimSpace(text) == "" {
				return nil, false
			}
			out = append(out, text)
		}
		return out, true
	default:
		return nil, false
	}
}

func textValue(value interface{}) string {
	text, _ := value.(string)
	return text
}
