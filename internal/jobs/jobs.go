package jobs

import (
	"context"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/mcp-hub/mcp-hub/internal/db"
	mcruntime "github.com/mcp-hub/mcp-hub/internal/runtime"
	"github.com/mcp-hub/mcp-hub/internal/telemetry"
)

type Kind string

const (
	ToolScan              Kind = "tool-scan"
	ResourceScan          Kind = "resources-list-scan"
	PromptScan            Kind = "prompts-list-scan"
	SchemaSnapshot        Kind = "schema-snapshot"
	SchemaDiff            Kind = "schema-diff"
	HealthCheck           Kind = "health-check"
	StaleSessionCleanup   Kind = "stale-session-cleanup"
	AuditRetentionCleanup Kind = "audit-retention-cleanup"
	AuditExport           Kind = "audit-export"
	RuntimeReconcile      Kind = "runtime-reconcile"
	SecretLeaseRenewal    Kind = "secret-lease-renewal"
	UsageAccountingReport Kind = "usage-accounting-report"
)

var DefaultKinds = []Kind{HealthCheck, ToolScan, ResourceScan, PromptScan, SchemaSnapshot, SchemaDiff, RuntimeReconcile, SecretLeaseRenewal, StaleSessionCleanup, AuditRetentionCleanup, AuditExport, UsageAccountingReport}

type Job struct {
	Kind             Kind                   `json:"kind"`
	TargetServerID   string                 `json:"targetServerId"`
	PreviousSnapshot []ToolSnapshot         `json:"previousSnapshot,omitempty"`
	CurrentSnapshot  []ToolSnapshot         `json:"currentSnapshot,omitempty"`
	ManifestPath     string                 `json:"manifestPath,omitempty"`
	ManifestJSON     map[string]interface{} `json:"manifestJson,omitempty"`
	DryRun           bool                   `json:"dryRun,omitempty"`
}
type ToolSnapshot struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	InputSchema map[string]interface{} `json:"inputSchema"`
	Risk        db.RiskLevel           `json:"risk"`
}
type Result struct {
	Job           Job                    `json:"job"`
	Status        string                 `json:"status"`
	FailureReason string                 `json:"failureReason,omitempty"`
	StartedAt     string                 `json:"startedAt"`
	FinishedAt    string                 `json:"finishedAt"`
	Metadata      map[string]interface{} `json:"metadata"`
}

type Registry struct {
	store *db.Store
	locks sync.Map
}

func NewRegistry(store *db.Store) *Registry {
	if store == nil {
		store = db.NewSeedStore()
	}
	return &Registry{store: store}
}

func (r *Registry) Store() *db.Store { return r.store }

func (r *Registry) RunOnce(ctx context.Context, jobs []Job) []Result {
	if telemetry.TraceID(ctx) == "" {
		ctx = telemetry.ContextWithNewCorrelation(ctx)
	}
	if len(jobs) == 0 {
		jobs = []Job{{Kind: HealthCheck, TargetServerID: db.K8sReadonlyID}, {Kind: ToolScan, TargetServerID: db.K8sReadonlyID}, {Kind: SchemaDiff, TargetServerID: db.K8sReadonlyID}, {Kind: RuntimeReconcile, TargetServerID: db.K8sReadonlyID, ManifestPath: "servers/k8s/mcp-server.manifest.json"}, {Kind: UsageAccountingReport, TargetServerID: db.K8sReadonlyID}}
	}
	results := make([]Result, 0, len(jobs))
	for _, job := range jobs {
		results = append(results, r.run(ctx, job))
	}
	return results
}

func (r *Registry) run(ctx context.Context, job Job) Result {
	wallStarted := time.Now()
	started := db.Now()
	result := Result{Job: job, Status: "success", StartedAt: started, Metadata: map[string]interface{}{"attempt": 1}}
	defer func() {
		telemetry.RecordJob("worker", string(job.Kind), result.Status, time.Since(wallStarted))
	}()
	lockKey := string(job.Kind) + ":" + job.TargetServerID
	if _, loaded := r.locks.LoadOrStore(lockKey, true); loaded {
		result.Status = "skipped"
		result.FailureReason = "duplicate job already running"
		result.FinishedAt = db.Now()
		return result
	}
	defer r.locks.Delete(lockKey)

	jobCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	select {
	case <-jobCtx.Done():
		result.Status = "failed"
		result.FailureReason = "job timeout"
		result.FinishedAt = db.Now()
		return result
	default:
	}

	switch job.Kind {
	case HealthCheck:
		health := r.healthCheck(job.TargetServerID, telemetry.TraceID(jobCtx))
		r.store.UpsertHealth(health)
		result.Metadata["status"] = health.Status
		result.Metadata["backoffSeconds"] = health.BackoffSeconds
	case ToolScan, ResourceScan, PromptScan:
		r.store.AddAudit(db.AuditEvent{EventType: "scan.completed", ServerID: job.TargetServerID, RiskLevel: db.RiskLow, PolicyDecision: db.PolicyAllow, TraceID: telemetry.TraceID(jobCtx), MetadataJSON: map[string]interface{}{"jobKind": job.Kind}})
	case SchemaSnapshot:
		snapshot, err := r.store.RecordCurrentSchemaSnapshot(job.TargetServerID, string(job.Kind))
		if err != nil {
			result.Status = "failed"
			result.FailureReason = err.Error()
			break
		}
		r.store.AddAudit(db.AuditEvent{EventType: "schema.snapshot.recorded", ServerID: job.TargetServerID, RiskLevel: db.RiskLow, PolicyDecision: db.PolicyAllow, TraceID: telemetry.TraceID(jobCtx), MetadataJSON: map[string]interface{}{"jobKind": job.Kind, "snapshotId": snapshot.ID}})
		result.Metadata["snapshotId"] = snapshot.ID
	case SchemaDiff:
		diffs := DiffToolSnapshots(job.PreviousSnapshot, job.CurrentSnapshot)
		var recorded db.SchemaDiff
		var err error
		if len(job.PreviousSnapshot)+len(job.CurrentSnapshot) > 0 {
			recorded, err = r.store.RecordSchemaDiffFromSnapshots(job.TargetServerID, string(job.Kind), toDBSnapshotItems(job.PreviousSnapshot), toDBSnapshotItems(job.CurrentSnapshot))
		} else {
			current, currentErr := r.store.SchemaDiff(job.TargetServerID)
			if currentErr != nil {
				err = currentErr
			} else {
				recorded, err = r.store.RecordSchemaDiff(job.TargetServerID, string(job.Kind), current.Changes)
				diffs = toJobDiffs(current.Changes)
			}
		}
		if err != nil {
			result.Status = "failed"
			result.FailureReason = err.Error()
			break
		}
		r.store.AddAudit(db.AuditEvent{EventType: "schema.changed", ServerID: job.TargetServerID, RiskLevel: db.RiskLow, PolicyDecision: db.PolicyAllow, TraceID: telemetry.TraceID(jobCtx), MetadataJSON: map[string]interface{}{"jobKind": job.Kind, "diffCount": len(diffs), "approvalRequired": approvalRequired(diffs)}})
		result.Metadata["diffCount"] = len(diffs)
		result.Metadata["approvalRequired"] = approvalRequired(diffs)
		result.Metadata["schemaDiffId"] = recorded.ID
	case AuditExport, UsageAccountingReport:
		report := r.store.UsageReport(map[string]string{"period": "daily"})
		calls := 0
		for _, item := range report.Items {
			calls += item.Calls
		}
		result.Metadata["reportRows"] = len(report.Items)
		result.Metadata["calls"] = calls
		r.store.AddAudit(db.AuditEvent{EventType: "usage.report.generated", ServerID: job.TargetServerID, RiskLevel: db.RiskLow, PolicyDecision: db.PolicyAllow, TraceID: telemetry.TraceID(jobCtx), MetadataJSON: map[string]interface{}{"jobKind": job.Kind, "period": report.Period, "rows": len(report.Items), "calls": calls}})
	case StaleSessionCleanup, AuditRetentionCleanup:
		r.store.AddAudit(db.AuditEvent{EventType: "maintenance.completed", ServerID: job.TargetServerID, RiskLevel: db.RiskLow, PolicyDecision: db.PolicyAllow, TraceID: telemetry.TraceID(jobCtx), MetadataJSON: map[string]interface{}{"jobKind": job.Kind}})
	case RuntimeReconcile:
		if err := r.reconcileRuntime(job, &result); err != nil {
			result.Status = "failed"
			result.FailureReason = err.Error()
		}
	case SecretLeaseRenewal:
		renewed := r.store.RenewExpiringSecretLeases(secretLeaseSeconds(), runtimeAuth(), db.NewID())
		result.Metadata["renewedCount"] = len(renewed)
	default:
		result.Status = "failed"
		result.FailureReason = fmt.Sprintf("unsupported job kind %s", job.Kind)
	}
	result.FinishedAt = db.Now()
	return result
}

func (r *Registry) reconcileRuntime(job Job, result *Result) error {
	manifest, err := loadManifest(job)
	if err != nil {
		return err
	}
	reconciler := mcruntime.NewReconciler(firstEnv("MCP_RUNTIME_NAMESPACE", mcruntime.DefaultNamespace))
	mode := firstEnv("MCP_RUNTIME_CONTROLLER_MODE", "render")
	switch mode {
	case "render":
		reconciler.DryRun = job.DryRun
	case "dry_run":
		reconciler.DryRun = true
	default:
		return fmt.Errorf("unsupported runtime controller mode %s", mode)
	}
	plan, err := reconciler.Reconcile(manifest)
	if err != nil {
		return err
	}
	serverID := job.TargetServerID
	if serverID == "" {
		if server, _, _, err := r.store.FindServerBySlug(manifest.Slug); err == nil {
			serverID = server.ID
		}
	}
	rendered := []map[string]interface{}{}
	resourceKinds := []string{}
	for _, resource := range plan.Resources {
		rendered = append(rendered, resource.Object)
		resourceKinds = append(resourceKinds, resource.Kind)
	}
	auth := runtimeAuth()
	traceID := db.NewID()
	status := db.RuntimeStatus{ServerID: serverID, ServerSlug: manifest.Slug, ManifestHash: plan.ManifestHash, Phase: plan.Phase, Namespace: plan.Namespace, ResourceKinds: resourceKinds, ResourceCount: len(plan.Resources), RenderedObjects: rendered, Warnings: plan.Warnings, LastReconciledAt: db.Now(), UpdatedAt: db.Now()}
	r.store.UpsertRuntimeStatus(status, auth, traceID, map[string]interface{}{"manifestPath": job.ManifestPath, "manifestHash": plan.ManifestHash, "phase": plan.Phase})
	leases := []db.SecretLease{}
	for _, lease := range plan.SecretLeases {
		leases = append(leases, db.SecretLease{ID: lease.ID, ServerID: serverID, ServerSlug: lease.ServerSlug, SecretRef: lease.SecretRef, TargetEnv: lease.TargetEnv, Status: lease.Status, IssuedAt: lease.IssuedAt, ExpiresAt: lease.ExpiresAt, LeaseDurationSeconds: lease.LeaseDurationSeconds})
	}
	r.store.UpsertSecretLeases(leases, auth, traceID, map[string]interface{}{"serverSlug": manifest.Slug, "leaseCount": len(leases)})
	result.Metadata["manifestHash"] = plan.ManifestHash
	result.Metadata["phase"] = plan.Phase
	result.Metadata["namespace"] = plan.Namespace
	result.Metadata["resourceKinds"] = resourceKinds
	result.Metadata["resourceCount"] = len(plan.Resources)
	result.Metadata["leaseCount"] = len(leases)
	return nil
}

func loadManifest(job Job) (mcruntime.Manifest, error) {
	if len(job.ManifestJSON) > 0 {
		return mcruntime.ManifestFromMap(job.ManifestJSON)
	}
	path := job.ManifestPath
	if path == "" {
		path = "servers/k8s/mcp-server.manifest.json"
	}
	return mcruntime.LoadManifest(path)
}

func runtimeAuth() db.AuthContext {
	return db.AuthContext{UserID: "runtime-controller", PrincipalType: db.SubjectServiceAccount, ClientID: "mcp-worker", Issuer: "worker", Audience: "mcp-hub", AuthSource: "worker", TokenIssuer: "worker", ProjectID: db.SampleProjectID, IsPlatformAdmin: true}
}

func firstEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func secretLeaseSeconds() int {
	if value := os.Getenv("MCP_SECRET_LEASE_SECONDS"); value != "" {
		var parsed int
		if _, err := fmt.Sscanf(value, "%d", &parsed); err == nil && parsed > 0 {
			return parsed
		}
	}
	return int(mcruntime.DefaultLeaseDuration.Seconds())
}

func (r *Registry) healthCheck(serverID, traceID string) db.ServerHealth {
	server, err := r.store.GetServer(serverID)
	status := "healthy"
	latencyMS := 10
	errorMessage := ""
	if err != nil {
		status = "unhealthy"
		latencyMS = 0
		errorMessage = "server not found"
	} else if !server.Enabled || server.Quarantined {
		status = "unhealthy"
		latencyMS = 0
		errorMessage = "server disabled or quarantined"
	} else if server.UpstreamURL == "" {
		status = "degraded"
		latencyMS = 25
		errorMessage = "upstream URL not configured"
	}
	previous, ok := r.store.LatestHealth(serverID)
	attempt := 1
	if ok && previous.Status != "healthy" && status != "healthy" {
		attempt = previous.Attempt + 1
		if attempt <= 1 {
			attempt = 2
		}
	}
	backoffSeconds := 0
	if status != "healthy" {
		backoffSeconds = 60
		for i := 1; i < attempt && backoffSeconds < 1800; i++ {
			backoffSeconds *= 2
		}
		if backoffSeconds > 1800 {
			backoffSeconds = 1800
		}
	}
	health := db.ServerHealth{ServerID: serverID, Status: status, LatencyMS: latencyMS, ErrorMessage: errorMessage, CheckedAt: db.Now(), TraceID: traceID, Attempt: attempt, BackoffSeconds: backoffSeconds}
	metadata := map[string]interface{}{"jobKind": HealthCheck, "status": status, "attempt": attempt, "backoffSeconds": backoffSeconds}
	if !ok || previous.Status != status {
		r.store.AddAudit(db.AuditEvent{EventType: "health.changed", ServerID: serverID, RiskLevel: db.RiskLow, PolicyDecision: db.PolicyAllow, TraceID: traceID, MetadataJSON: metadata})
	}
	if status != "healthy" {
		r.store.AddAudit(db.AuditEvent{EventType: "health.alert", ServerID: serverID, RiskLevel: db.RiskMedium, PolicyDecision: db.PolicyDeny, TraceID: traceID, ErrorCode: "SERVER_HEALTH_" + strings.ToUpper(status), MetadataJSON: metadata})
	}
	return health
}

type Diff struct {
	Type             string `json:"type"`
	ToolName         string `json:"toolName"`
	ApprovalRequired bool   `json:"approvalRequired"`
	HighRisk         bool   `json:"highRisk"`
}

func DiffToolSnapshots(previous, current []ToolSnapshot) []Diff {
	prev := index(previous)
	curr := index(current)
	out := []Diff{}
	seen := map[string]bool{}
	for name, tool := range curr {
		seen[name] = true
		old, ok := prev[name]
		if !ok {
			out = append(out, Diff{Type: "tool_added", ToolName: name, ApprovalRequired: high(tool.Risk), HighRisk: high(tool.Risk)})
			continue
		}
		if old.Description != tool.Description {
			out = append(out, Diff{Type: "tool_description_changed", ToolName: name})
		}
		if fmt.Sprint(old.InputSchema) != fmt.Sprint(tool.InputSchema) {
			out = append(out, Diff{Type: "tool_input_schema_changed", ToolName: name, ApprovalRequired: true, HighRisk: true})
		}
		if old.Risk != tool.Risk {
			out = append(out, Diff{Type: "tool_risk_changed", ToolName: name, ApprovalRequired: high(tool.Risk), HighRisk: true})
		}
	}
	for name := range prev {
		if !seen[name] {
			out = append(out, Diff{Type: "tool_removed", ToolName: name, ApprovalRequired: true, HighRisk: true})
		}
	}
	return out
}

func index(snapshot []ToolSnapshot) map[string]ToolSnapshot {
	out := map[string]ToolSnapshot{}
	for _, tool := range snapshot {
		out[tool.Name] = tool
	}
	return out
}

func toDBSnapshotItems(snapshot []ToolSnapshot) []db.ToolSchemaSnapshotItem {
	items := make([]db.ToolSchemaSnapshotItem, 0, len(snapshot))
	for _, tool := range snapshot {
		items = append(items, db.ToolSchemaSnapshotItem{Name: tool.Name, Description: tool.Description, RiskLevel: tool.Risk, InputSchema: tool.InputSchema})
	}
	return items
}

func toJobDiffs(changes []db.SchemaChange) []Diff {
	out := make([]Diff, 0, len(changes))
	for _, change := range changes {
		out = append(out, Diff{Type: change.Type, ToolName: change.ToolName, ApprovalRequired: change.ApprovalRequired, HighRisk: change.ToRiskLevel == db.RiskHigh || change.ToRiskLevel == db.RiskCritical || change.FromRiskLevel == db.RiskHigh || change.FromRiskLevel == db.RiskCritical})
	}
	return out
}

func high(risk db.RiskLevel) bool { return risk == db.RiskHigh || risk == db.RiskCritical }
func approvalRequired(diffs []Diff) bool {
	for _, diff := range diffs {
		if diff.ApprovalRequired {
			return true
		}
	}
	return false
}
