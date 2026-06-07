package db

import (
	"encoding/json"
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

func MockAuth() AuthContext {
	return AuthContext{UserID: AdminUserID, TeamIDs: []string{PlatformTeamID}, ProjectID: SampleProjectID, IsPlatformAdmin: true}
}
