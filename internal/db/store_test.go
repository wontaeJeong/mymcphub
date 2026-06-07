package db

import (
	"path/filepath"
	"testing"
)

func TestPersistentStoreSharesMutationsAcrossInstances(t *testing.T) {
	path := filepath.Join(t.TempDir(), "store.json")
	writer := NewSeedStore()
	writer.UsePersistence(path)

	created, err := writer.CreateServer(MCPServer{Slug: "qa-shared", DisplayName: "QA Shared", OwnerTeamID: PlatformTeamID, Enabled: true}, []MCPTool{{Name: "qa_echo", Description: "QA echo", Enabled: true, InputSchema: emptySchema()}}, MockAuth(), "trace-shared", nil)
	if err != nil {
		t.Fatalf("create server: %v", err)
	}
	writer.Save()

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

func MockAuth() AuthContext {
	return AuthContext{UserID: AdminUserID, TeamIDs: []string{PlatformTeamID}, ProjectID: SampleProjectID, IsPlatformAdmin: true}
}
