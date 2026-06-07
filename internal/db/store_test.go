package db

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestPersistentStoreSharesMutationsAcrossInstances(t *testing.T) {
	path := filepath.Join(t.TempDir(), "store.json")
	writer := NewSeedStore()
	writer.UsePersistence(path)

	created, err := writer.CreateServer(MCPServer{Slug: "qa-shared", DisplayName: "QA Shared", OwnerTeamID: PlatformTeamID, Enabled: true}, []MCPTool{{Name: "qa_echo", Description: "QA echo", Enabled: true, InputSchema: emptySchema()}}, MockAuth(), "trace-shared", nil)
	if err != nil {
		t.Fatalf("create server: %v", err)
	}
	if err := writer.Save(); err != nil {
		t.Fatalf("save store: %v", err)
	}

	reader := NewSeedStore()
	reader.UsePersistence(path)
	server, tools, grants, err := reader.FindServerBySlug("qa-shared")
	if err != nil {
		t.Fatalf("find shared server: %v", err)
	}
	if server.ID != created.ID {
		t.Fatalf("expected server %s, got %s", created.ID, server.ID)
	}
	if len(tools) != 1 || tools[0].Name != "qa_echo" {
		t.Fatalf("expected shared tool qa_echo, got %#v", tools)
	}
	if len(grants) != 0 {
		t.Fatalf("expected no grants for new server, got %#v", grants)
	}
}
func TestAddAuditPersistsWithoutClobberingNewerCatalog(t *testing.T) {
	path := filepath.Join(t.TempDir(), "store.json")
	initial := NewSeedStore()
	initial.UsePersistence(path)
	if err := initial.Save(); err != nil {
		t.Fatalf("save initial store: %v", err)
	}

	gateway := NewSeedStore()
	gateway.UsePersistence(path)

	writer := NewSeedStore()
	writer.UsePersistence(path)
	created, err := writer.CreateServer(MCPServer{Slug: "newer", DisplayName: "Newer", OwnerTeamID: PlatformTeamID, Enabled: true}, []MCPTool{{Name: "probe", Enabled: true, InputSchema: emptySchema()}}, MockAuth(), "trace-newer", nil)
	if err != nil {
		t.Fatalf("create newer server: %v", err)
	}
	if err := writer.Save(); err != nil {
		t.Fatalf("save newer store: %v", err)
	}

	gateway.AddAudit(AuditEvent{EventType: "gateway.audit", RiskLevel: RiskLow, PolicyDecision: PolicyAllow, TraceID: "trace-audit", MetadataJSON: map[string]interface{}{"stepUpToken": "live-token"}, ArgumentRedactedJSON: map[string]interface{}{"token": "secret-value"}})

	reader := NewSeedStore()
	reader.UsePersistence(path)
	server, _, _, err := reader.FindServerBySlug("newer")
	if err != nil || server.ID != created.ID {
		t.Fatalf("expected newer catalog entry to survive audit append, server=%#v err=%v", server, err)
	}
	audit := reader.ListAuditEvents(10, "", map[string]string{"event_type": "gateway.audit"})
	encoded, _ := json.Marshal(audit.Items)
	if strings.Contains(string(encoded), "live-token") || strings.Contains(string(encoded), "secret-value") {
		t.Fatalf("audit persistence leaked token or secret: %s", string(encoded))
	}
}

func TestRateLimitBucketPersistsAcrossStoreInstances(t *testing.T) {
	path := filepath.Join(t.TempDir(), "store.json")
	writer := NewSeedStore()
	writer.UsePersistence(path)
	count, _, err := writer.IncrementRateLimitBucket("user:admin|path:/api/me", time.Minute)
	if err != nil || count != 1 {
		t.Fatalf("expected first quota increment, count=%d err=%v", count, err)
	}

	reader := NewSeedStore()
	reader.UsePersistence(path)
	count, _, err = reader.IncrementRateLimitBucket("user:admin|path:/api/me", time.Minute)
	if err != nil || count != 2 {
		t.Fatalf("expected persisted quota increment, count=%d err=%v", count, err)
	}
}

func TestSaveMergesLatestAuditAndRateLimitState(t *testing.T) {
	path := filepath.Join(t.TempDir(), "store.json")
	staleWriter := NewSeedStore()
	staleWriter.UsePersistence(path)
	if err := staleWriter.Save(); err != nil {
		t.Fatalf("save initial store: %v", err)
	}

	gateway := NewSeedStore()
	gateway.UsePersistence(path)
	if _, _, err := gateway.IncrementRateLimitBucket("user:admin|route:/mcp/k8s", time.Minute); err != nil {
		t.Fatalf("increment gateway quota: %v", err)
	}
	gateway.AddAudit(AuditEvent{EventType: "gateway.audit", RiskLevel: RiskLow, PolicyDecision: PolicyAllow, TraceID: "trace-gateway"})

	staleWriter.auditEvents = append([]AuditEvent{{ID: NewID(), Timestamp: Now(), EventType: "api.audit", RiskLevel: RiskLow, PolicyDecision: PolicyAllow, TraceID: "trace-api", MetadataJSON: map[string]interface{}{}}}, staleWriter.auditEvents...)
	if err := staleWriter.Save(); err != nil {
		t.Fatalf("save stale writer: %v", err)
	}

	reader := NewSeedStore()
	reader.UsePersistence(path)
	count, _, err := reader.IncrementRateLimitBucket("user:admin|route:/mcp/k8s", time.Minute)
	if err != nil || count != 2 {
		t.Fatalf("expected quota state to survive stale save, count=%d err=%v", count, err)
	}
	if got := reader.ListAuditEvents(10, "", map[string]string{"event_type": "gateway.audit"}); len(got.Items) != 1 {
		t.Fatalf("expected gateway audit to survive stale save, got %d", len(got.Items))
	}
}

func TestRateLimitBucketsPruneExpiredEntries(t *testing.T) {
	store := NewSeedStore()
	store.rateLimits = []RateLimitBucket{{Key: "expired", Count: 99, ResetAt: time.Now().UTC().Add(-time.Minute).Format(time.RFC3339Nano)}}
	if _, _, err := store.IncrementRateLimitBucket("current", time.Minute); err != nil {
		t.Fatalf("increment quota: %v", err)
	}
	if len(store.rateLimits) != 1 || store.rateLimits[0].Key != "current" {
		t.Fatalf("expected expired bucket pruned, got %#v", store.rateLimits)
	}
}

func TestSchemaDiffTracksToolSchemaChangeAndSnapshotHistory(t *testing.T) {
	store := NewSeedStore()
	tools, err := store.ListTools(K8sReadonlyID)
	if err != nil {
		t.Fatalf("list tools: %v", err)
	}
	if len(tools.Items) == 0 {
		t.Fatalf("expected seed tools")
	}

	_, err = store.PatchTool(K8sReadonlyID, tools.Items[0].ID, map[string]interface{}{"inputSchema": map[string]interface{}{"type": "object", "required": []interface{}{"namespace"}}}, MockAuth(), "trace-schema")
	if err != nil {
		t.Fatalf("patch tool schema: %v", err)
	}

	diff, err := store.SchemaDiff(K8sReadonlyID)
	if err != nil {
		t.Fatalf("schema diff: %v", err)
	}
	if diff.Status != "changes_detected" || !diff.ApprovalRequired || len(diff.Changes) == 0 {
		t.Fatalf("expected approval-required schema change, got %#v", diff)
	}
	snapshots, err := store.ListSchemaSnapshots(K8sReadonlyID)
	if err != nil {
		t.Fatalf("list snapshots: %v", err)
	}
	if len(snapshots.Items) < 2 {
		t.Fatalf("expected seed and patch snapshots, got %#v", snapshots.Items)
	}
}

func TestTenancySecretBindingKillSwitchAndAuditExport(t *testing.T) {
	store := NewSeedStore()
	auth := MockAuth()
	user, err := store.CreateUser(User{Email: "operator@example.com", DisplayName: "Operator"}, auth, "trace-user")
	if err != nil {
		t.Fatalf("create user: %v", err)
	}
	team, err := store.CreateTeam(Team{Slug: "ops", DisplayName: "Ops"}, auth, "trace-team")
	if err != nil {
		t.Fatalf("create team: %v", err)
	}
	if _, err := store.AddTeamMember(TeamMembership{TeamID: team.ID, UserID: user.ID, Role: "admin"}, auth, "trace-member"); err != nil {
		t.Fatalf("add team member: %v", err)
	}
	project, err := store.CreateProject(Project{Slug: "ops-project", DisplayName: "Ops Project", OwnerTeamID: team.ID}, auth, "trace-project")
	if err != nil {
		t.Fatalf("create project: %v", err)
	}
	if _, err := store.AddProjectMember(ProjectMembership{ProjectID: project.ID, SubjectType: SubjectTeam, SubjectID: team.ID, Role: "admin"}, auth, "trace-project-member"); err != nil {
		t.Fatalf("add project member: %v", err)
	}
	input, err := store.PolicyInputFor(user.ID, project.ID)
	if err != nil {
		t.Fatalf("policy input: %v", err)
	}
	if input.Principal.UserID != user.ID || len(input.Principal.TeamIDs) != 1 || input.Project.ID != project.ID {
		t.Fatalf("unexpected policy input: %#v", input)
	}

	binding, err := store.CreateSecretBinding(SecretBinding{ScopeType: "server", ScopeID: K8sReadonlyID, Provider: "vault", Ref: "vault://mcp/k8s-readonly", LeaseRenewable: true}, auth, "trace-secret")
	if err != nil {
		t.Fatalf("create secret binding: %v", err)
	}
	bindings := store.ListSecretBindings(map[string]string{"scope_id": K8sReadonlyID})
	if len(bindings.Items) != 1 || bindings.Items[0].ID != binding.ID || bindings.Items[0].Ref == "" {
		t.Fatalf("unexpected secret bindings: %#v", bindings.Items)
	}

	exportJob, err := store.CreateAuditExportJob(map[string]string{"server": K8sReadonlyID}, "json", auth, "trace-export")
	if err != nil {
		t.Fatalf("create audit export job: %v", err)
	}
	if exportJob.Status != "queued" || exportJob.Filters["server"] != K8sReadonlyID {
		t.Fatalf("unexpected export job: %#v", exportJob)
	}

	result, err := store.ApplyKillSwitch(KillSwitchRequest{Reason: "incident", ServerID: K8sReadonlyID, RevokeGrants: true}, auth, "trace-kill")
	if err != nil {
		t.Fatalf("apply kill switch: %v", err)
	}
	if result.Server == nil || result.Server.Enabled || !result.Server.Quarantined || result.RevokedGrants == 0 || !result.EmergencyDeny.Enabled {
		t.Fatalf("unexpected kill switch result: %#v", result)
	}
}

func TestMutationAuditRedactsArguments(t *testing.T) {
	store := NewSeedStore()
	_, err := store.CreateGrant(Grant{SubjectType: SubjectTeam, SubjectID: PlatformTeamID, ProjectID: SampleProjectID, ServerID: K8sReadonlyID, AllowedTools: []string{"list_namespaces"}, Environment: EnvironmentDev, Reason: "redaction", Enabled: true}, MockAuth(), "trace-redact", map[string]interface{}{"reason": "redaction", "apiToken": "secret-token"})
	if err != nil {
		t.Fatalf("create grant: %v", err)
	}
	audit := store.ListAuditEvents(10, "", map[string]string{"event_type": "grant.created"})
	if len(audit.Items) != 1 {
		t.Fatalf("expected one grant audit, got %#v", audit.Items)
	}
	redacted, ok := audit.Items[0].ArgumentRedactedJSON.(map[string]interface{})
	if !ok {
		t.Fatalf("expected redacted audit map, got %#v", audit.Items[0].ArgumentRedactedJSON)
	}
	if redacted["apiToken"] != "[REDACTED]" || audit.Items[0].ArgumentHash == "" {
		t.Fatalf("expected redacted token and argument hash, got %#v", audit.Items[0])
	}
}

func TestGatewayAuditRedactsSuppliedArguments(t *testing.T) {
	store := NewSeedStore()
	event := store.RecordGatewayAudit(AuditEvent{EventType: "gateway.tool_call", MetadataJSON: map[string]interface{}{"apiKey": "metadata-secret", "headers": map[string]interface{}{"Authorization": "Bearer metadata-secret", "safe": "kept"}}, ArgumentRedactedJSON: map[string]interface{}{"apiToken": "secret-token", "apiKey": "secret-api-key", "privateKey": "secret-private-key", "nested": map[string]interface{}{"password": "secret-password", "passwd": "secret-passwd", "kubeconfig": "secret-kubeconfig", "safe": "kept"}, "headers": map[string]interface{}{"Authorization": "Bearer secret", "Cookie": "session=secret", "safe": "kept"}}})
	redacted, ok := event.ArgumentRedactedJSON.(map[string]interface{})
	if !ok {
		t.Fatalf("expected redacted audit map, got %#v", event.ArgumentRedactedJSON)
	}
	nested, ok := redacted["nested"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected nested redacted audit map, got %#v", redacted["nested"])
	}
	headers, ok := redacted["headers"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected header redacted audit map, got %#v", redacted["headers"])
	}
	metadataHeaders, ok := event.MetadataJSON["headers"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected metadata header map, got %#v", event.MetadataJSON["headers"])
	}
	if redacted["apiToken"] != "[REDACTED]" || redacted["apiKey"] != "[REDACTED]" || redacted["privateKey"] != "[REDACTED]" || nested["password"] != "[REDACTED]" || nested["passwd"] != "[REDACTED]" || nested["kubeconfig"] != "[REDACTED]" || nested["safe"] != "kept" || headers["Authorization"] != "[REDACTED]" || headers["Cookie"] != "[REDACTED]" || headers["safe"] != "kept" || event.MetadataJSON["apiKey"] != "[REDACTED]" || metadataHeaders["Authorization"] != "[REDACTED]" || metadataHeaders["safe"] != "kept" || event.ArgumentHash == "" {
		t.Fatalf("expected sanitized gateway audit payload and hash, got %#v", event)
	}
}

func TestAddAuditRedactsSuppliedMetadata(t *testing.T) {
	store := NewSeedStore()
	store.AddAudit(AuditEvent{EventType: "manual.audit", RiskLevel: RiskLow, PolicyDecision: PolicyAllow, TraceID: "trace-add-audit", MetadataJSON: map[string]interface{}{"apiKey": "metadata-secret", "headers": map[string]interface{}{"Authorization": "Bearer metadata-secret", "Cookie": "session=metadata-secret", "safe": "kept"}}, ArgumentRedactedJSON: map[string]interface{}{"privateKey": "argument-secret", "safe": "kept"}})

	audit := store.ListAuditEvents(10, "", map[string]string{"event_type": "manual.audit"})
	if len(audit.Items) != 1 {
		t.Fatalf("expected one manual audit, got %#v", audit.Items)
	}
	metadata := audit.Items[0].MetadataJSON
	headers, ok := metadata["headers"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected metadata header map, got %#v", metadata["headers"])
	}
	argument, ok := audit.Items[0].ArgumentRedactedJSON.(map[string]interface{})
	if !ok {
		t.Fatalf("expected redacted argument map, got %#v", audit.Items[0].ArgumentRedactedJSON)
	}
	if metadata["apiKey"] != "[REDACTED]" || headers["Authorization"] != "[REDACTED]" || headers["Cookie"] != "[REDACTED]" || headers["safe"] != "kept" || argument["privateKey"] != "[REDACTED]" || argument["safe"] != "kept" {
		t.Fatalf("expected sanitized AddAudit metadata and arguments, got %#v", audit.Items[0])
	}
}

func TestSecretBindingRejectsInlineSecretAndAuditsRefHash(t *testing.T) {
	store := NewSeedStore()
	if _, err := store.CreateSecretBinding(SecretBinding{ScopeType: "server", ScopeID: K8sReadonlyID, Provider: "vault", Ref: "plaintext-secret"}, MockAuth(), "trace-secret-inline"); err == nil {
		t.Fatalf("expected inline secret binding ref to be rejected")
	}
	if _, err := store.CreateSecretBinding(SecretBinding{ScopeType: "server", ScopeID: K8sReadonlyID, Provider: "v", Ref: "vault://mcp/k8s-readonly"}, MockAuth(), "trace-secret-provider"); err == nil {
		t.Fatalf("expected unknown provider to be rejected")
	}
	if _, err := store.CreateSecretBinding(SecretBinding{ScopeType: "server", ScopeID: NewID(), Provider: "vault", Ref: "vault://mcp/k8s-readonly"}, MockAuth(), "trace-secret-scope"); err == nil {
		t.Fatalf("expected nonexistent secret binding scope to be rejected")
	}
	if _, err := store.CreateSecretBinding(SecretBinding{ScopeType: "server", ScopeID: K8sReadonlyID, Provider: "vault", Ref: "vault://mcp/k8s-readonly"}, MockAuth(), "trace-secret-valid"); err != nil {
		t.Fatalf("create valid secret binding: %v", err)
	}
	audit := store.ListAuditEvents(10, "", map[string]string{"event_type": "secret_binding.created"})
	if len(audit.Items) != 1 {
		t.Fatalf("expected one secret binding audit, got %#v", audit.Items)
	}
	redacted, ok := audit.Items[0].ArgumentRedactedJSON.(map[string]interface{})
	if !ok {
		t.Fatalf("expected audit argument map, got %#v", audit.Items[0].ArgumentRedactedJSON)
	}
	if redacted["ref"] != nil || redacted["refHash"] == "" {
		t.Fatalf("expected only ref hash in secret binding audit, got %#v", redacted)
	}
}

func TestGlobalKillSwitchRevokesAllGrants(t *testing.T) {
	store := NewSeedStore()
	result, err := store.ApplyKillSwitch(KillSwitchRequest{Reason: "global incident", Global: true, RevokeGrants: true}, MockAuth(), "trace-global-kill")
	if err != nil {
		t.Fatalf("apply global kill switch: %v", err)
	}
	if result.RevokedGrants != 1 || !result.EmergencyDeny.Global {
		t.Fatalf("expected global grant revocation, got %#v", result)
	}
	grants := store.ListGrants()
	for _, grant := range grants.Items {
		if grant.Enabled {
			t.Fatalf("expected all grants disabled, got %#v", grants.Items)
		}
	}
}

func TestGlobalKillSwitchWithServerTargetRevokesAllGrants(t *testing.T) {
	store := NewSeedStore()
	server, err := store.CreateServer(MCPServer{Slug: "global-target", DisplayName: "Global Target", OwnerTeamID: PlatformTeamID, Enabled: true}, []MCPTool{{Name: "global_echo", Description: "Global echo", Enabled: true, InputSchema: emptySchema()}}, MockAuth(), "trace-server", nil)
	if err != nil {
		t.Fatalf("create server: %v", err)
	}
	if _, err := store.CreateGrant(Grant{SubjectType: SubjectTeam, SubjectID: PlatformTeamID, ProjectID: SampleProjectID, ServerID: server.ID, AllowedTools: []string{"global_echo"}, Environment: EnvironmentDev, Reason: "global kill", Enabled: true}, MockAuth(), "trace-grant", nil); err != nil {
		t.Fatalf("create grant: %v", err)
	}
	result, err := store.ApplyKillSwitch(KillSwitchRequest{Reason: "global incident", Global: true, ServerID: K8sReadonlyID, RevokeGrants: true}, MockAuth(), "trace-global-target-kill")
	if err != nil {
		t.Fatalf("apply global kill switch with server target: %v", err)
	}
	if result.RevokedGrants != 2 || !result.EmergencyDeny.Global {
		t.Fatalf("expected all grants revoked under global kill switch, got %#v", result)
	}
	for _, grant := range store.ListGrants().Items {
		if grant.Enabled {
			t.Fatalf("expected all grants disabled, got %#v", store.ListGrants().Items)
		}
	}
}

func TestPersistenceBackfillsLaneBSeedData(t *testing.T) {
	path := filepath.Join(t.TempDir(), "store.json")
	now := Now()
	legacy := snapshot{
		Servers: []MCPServer{seedServer(K8sReadonlyID, "k8s-readonly", "Kubernetes Readonly MCP Server", "legacy", TransportStreamableHTTP, RiskMedium, "http://localhost:5102/mcp", now)},
		Tools:   []MCPTool{seedTool(K8sReadonlyID, "list_namespaces", "legacy", RiskMedium, emptySchema(), now)},
		Grants:  []Grant{{ID: SampleGrantID, SubjectType: SubjectTeam, SubjectID: PlatformTeamID, ProjectID: SampleProjectID, ServerID: K8sReadonlyID, AllowedTools: []string{"list_namespaces"}, Environment: EnvironmentDev, ApprovedBy: AdminUserID, Reason: "legacy", Enabled: true, CreatedAt: now}},
	}
	encoded, err := json.Marshal(legacy)
	if err != nil {
		t.Fatalf("marshal legacy store: %v", err)
	}
	if err := os.WriteFile(path, encoded, 0o600); err != nil {
		t.Fatalf("write legacy store: %v", err)
	}
	store := NewSeedStore()
	store.UsePersistence(path)
	if _, err := store.PolicyInputFor(AdminUserID, SampleProjectID); err != nil {
		t.Fatalf("expected backfilled tenancy seed data: %v", err)
	}
	snapshots, err := store.ListSchemaSnapshots(K8sReadonlyID)
	if err != nil {
		t.Fatalf("list backfilled schema snapshots: %v", err)
	}
	if len(snapshots.Items) != 1 || snapshots.Items[0].Source != "backfill" {
		t.Fatalf("expected backfilled schema snapshot, got %#v", snapshots.Items)
	}
	reloaded := NewSeedStore()
	reloaded.UsePersistence(path)
	if _, err := reloaded.PolicyInputFor(AdminUserID, SampleProjectID); err != nil {
		t.Fatalf("expected persisted backfilled tenancy seed data: %v", err)
	}
}

func MockAuth() AuthContext {
	return AuthContext{UserID: AdminUserID, TeamIDs: []string{PlatformTeamID}, ProjectID: SampleProjectID, IsPlatformAdmin: true}
}

func TestMutationAuditRedactsSensitiveArguments(t *testing.T) {
	store := NewSeedStore()
	_, err := store.CreateVersion(K8sReadonlyID, MCPServerVersion{Version: "v2"}, MockAuth(), "trace-redact", map[string]interface{}{"token": "raw-token", "nested": map[string]interface{}{"password": "raw-password"}})
	if err != nil {
		t.Fatalf("create version: %v", err)
	}
	audit := store.ListAuditEvents(10, "", map[string]string{"event_type": "mcp_server_version.created"})
	if len(audit.Items) != 1 {
		t.Fatalf("expected audit event")
	}
	encoded, _ := json.Marshal(audit.Items[0].ArgumentRedactedJSON)
	if string(encoded) != `{"nested":{"password":"[REDACTED]"},"token":"[REDACTED]"}` {
		t.Fatalf("expected redacted audit argument, got %s", encoded)
	}
}

func TestCreateVersionRejectsRawSecretManifest(t *testing.T) {
	store := NewSeedStore()
	_, err := store.CreateVersion(K8sReadonlyID, MCPServerVersion{Version: "v2", ManifestJSON: map[string]interface{}{
		"slug":                   "bad-secret",
		"displayName":            "Bad Secret",
		"ownerTeamId":            PlatformTeamID,
		"environment":            "dev",
		"transport":              "streamable_http",
		"riskLevel":              "low",
		"implementationLanguage": "go",
		"secrets":                []interface{}{map[string]interface{}{"ref": "provider", "targetEnv": "PROVIDER_TOKEN", "secretName": "provider", "secretKey": "token", "apiKey": "raw-secret"}},
		"tools":                  []interface{}{map[string]interface{}{"name": "probe", "riskLevel": "low", "readOnly": true, "inputSchema": map[string]interface{}{"type": "object", "properties": map[string]interface{}{}, "additionalProperties": false}}},
	}}, MockAuth(), "trace", nil)
	if err == nil {
		t.Fatal("expected raw secret manifest validation error")
	}
}
