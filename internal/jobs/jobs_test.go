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

func TestRuntimeReconcileJobPersistsStatusAndSecretLease(t *testing.T) {
	store := db.NewSeedStore()
	registry := NewRegistry(store)
	manifest := map[string]interface{}{
		"slug":                   "k8s-readonly",
		"displayName":            "Kubernetes Readonly",
		"ownerTeamId":            db.PlatformTeamID,
		"environment":            "dev",
		"transport":              "streamable_http",
		"riskLevel":              "medium",
		"implementationLanguage": "go",
		"runtime":                map[string]interface{}{"image": "registry.example.com/k8s:1", "port": float64(5102)},
		"secrets":                []interface{}{map[string]interface{}{"ref": "kubeconfig", "targetEnv": "KUBECONFIG", "secretName": "k8s-readonly", "secretKey": "kubeconfig", "leaseDurationSeconds": float64(600)}},
		"tools":                  []interface{}{map[string]interface{}{"name": "list_namespaces", "riskLevel": "medium", "readOnly": true, "inputSchema": map[string]interface{}{"type": "object", "properties": map[string]interface{}{}, "additionalProperties": false}}},
	}
	results := registry.RunOnce(context.Background(), []Job{{Kind: RuntimeReconcile, TargetServerID: db.K8sReadonlyID, ManifestJSON: manifest}})
	if len(results) != 1 || results[0].Status != "success" {
		t.Fatalf("unexpected results: %#v", results)
	}
	if statuses := store.ListRuntimeStatus(); len(statuses.Items) != 1 || statuses.Items[0].ResourceCount == 0 {
		t.Fatalf("expected persisted runtime status, got %#v", statuses)
	}
	if leases := store.ListSecretLeases(false); len(leases.Items) != 1 || leases.Items[0].Status != "active" {
		t.Fatalf("expected active secret lease, got %#v", leases)
	}
}
