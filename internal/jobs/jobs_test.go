package jobs

import (
	"context"
	"testing"

	"github.com/mcp-hub/mcp-hub/internal/db"
)

func TestSchemaDiffRequiresApprovalForInputSchemaChange(t *testing.T) {
	diffs := DiffToolSnapshots([]ToolSnapshot{{Name: "tool", Description: "old", InputSchema: map[string]interface{}{"type": "object"}, Risk: db.RiskLow}}, []ToolSnapshot{{Name: "tool", Description: "old", InputSchema: map[string]interface{}{"type": "object", "required": []interface{}{"x"}}, Risk: db.RiskLow}})
	if len(diffs) != 1 || !diffs[0].ApprovalRequired {
		t.Fatalf("expected approval-required schema diff, got %#v", diffs)
	}
}

func TestRegistryRunsJobsWithoutKillingProcess(t *testing.T) {
	registry := NewRegistry(db.NewSeedStore())
	results := registry.RunOnce(context.Background(), []Job{{Kind: HealthCheck, TargetServerID: db.K8sReadonlyID}, {Kind: Kind("missing"), TargetServerID: db.K8sReadonlyID}})
	if len(results) != 2 {
		t.Fatalf("expected two results")
	}
	if results[0].Status != "success" || results[1].Status != "failed" {
		t.Fatalf("unexpected results: %#v", results)
	}
}

func TestRegistryPersistsSchemaDiffToStore(t *testing.T) {
	store := db.NewSeedStore()
	registry := NewRegistry(store)
	results := registry.RunOnce(context.Background(), []Job{{Kind: SchemaDiff, TargetServerID: db.K8sReadonlyID, PreviousSnapshot: []ToolSnapshot{{Name: "probe", Description: "old", InputSchema: map[string]interface{}{"type": "object"}, Risk: db.RiskLow}}, CurrentSnapshot: []ToolSnapshot{{Name: "probe", Description: "old", InputSchema: map[string]interface{}{"type": "object", "required": []interface{}{"namespace"}}, Risk: db.RiskHigh}}}})
	if len(results) != 1 || results[0].Status != "success" {
		t.Fatalf("unexpected schema diff result: %#v", results)
	}
	diff, err := store.SchemaDiff(db.K8sReadonlyID)
	if err != nil {
		t.Fatalf("schema diff: %v", err)
	}
	if diff.Status != "changes_detected" || !diff.ApprovalRequired || len(diff.Changes) == 0 {
		t.Fatalf("expected recorded approval-required diff, got %#v", diff)
	}
}
