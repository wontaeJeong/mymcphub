package migration

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"github.com/mcp-hub/mcp-hub/internal/db"
	"github.com/mcp-hub/mcp-hub/internal/testutil"
)

func TestMigrationFilesAreOrderedAndIdempotent(t *testing.T) {
	migrationDir := filepath.Join(testutil.RepoRoot(t), "internal", "db", "migrations")
	entries, err := os.ReadDir(migrationDir)
	if err != nil {
		t.Fatal(err)
	}
	var names []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".sql") {
			names = append(names, entry.Name())
		}
	}
	if len(names) == 0 {
		t.Fatal("expected at least one migration file")
	}
	if !sort.StringsAreSorted(names) {
		t.Fatalf("migration files must be lexically ordered: %#v", names)
	}
	for _, name := range names {
		if len(name) < len("0001_description.sql") || name[4] != '_' {
			t.Fatalf("migration %s must use zero-padded numeric prefix", name)
		}
		data, err := os.ReadFile(filepath.Join(migrationDir, name))
		if err != nil {
			t.Fatal(err)
		}
		text := strings.ToLower(string(data))
		if !strings.Contains(text, "if not exists") {
			t.Fatalf("migration %s should be idempotent with IF NOT EXISTS guards", name)
		}
		if strings.Contains(text, "drop table") || strings.Contains(text, "drop column") {
			t.Fatalf("migration %s contains destructive drop statement", name)
		}
	}
}

func TestSeedFixtureMatchesRuntimeStoreAndMigrationTables(t *testing.T) {
	fixture := testutil.LocalSeedFixture(t)
	store := db.NewSeedStore()
	server, tools, grants, err := store.FindServerBySlug("k8s-readonly")
	if err != nil {
		t.Fatal(err)
	}
	if server.ID != fixture.Servers[0].ID || server.OwnerTeamID != fixture.Projects[0].OwnerTeamID {
		t.Fatalf("seed server drifted from fixture: server=%#v fixture=%#v", server, fixture.Servers[0])
	}
	if len(tools) != len(fixture.Servers[0].Tools) || len(grants) != len(fixture.Grants) {
		t.Fatalf("seed fixture mismatch tools=%d/%d grants=%d/%d", len(tools), len(fixture.Servers[0].Tools), len(grants), len(fixture.Grants))
	}

	initial, err := os.ReadFile(filepath.Join(testutil.RepoRoot(t), "internal", "db", "migrations", "0001_initial_schema.sql"))
	if err != nil {
		t.Fatal(err)
	}
	for _, table := range []string{"users", "teams", "projects", "mcp_servers", "mcp_tools", "mcp_grants"} {
		if !strings.Contains(string(initial), "create table if not exists "+table) {
			t.Fatalf("initial migration missing seed-compatible table %s", table)
		}
	}

	path := filepath.Join(t.TempDir(), "store.json")
	writer := db.NewSeedStore()
	writer.UsePersistence(path)
	writer.Save()
	reader := db.NewSeedStore()
	reader.UsePersistence(path)
	loaded, loadedTools, loadedGrants, err := reader.FindServerBySlug("k8s-readonly")
	if err != nil {
		t.Fatal(err)
	}
	if loaded.ID != server.ID || len(loadedTools) != len(tools) || len(loadedGrants) != len(grants) {
		t.Fatalf("persisted seed is not upgrade-compatible: server=%#v tools=%d grants=%d", loaded, len(loadedTools), len(loadedGrants))
	}
}
