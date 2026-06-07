package jobs

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/mcp-hub/mcp-hub/internal/db"
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
)

var DefaultKinds = []Kind{HealthCheck, ToolScan, ResourceScan, PromptScan, SchemaSnapshot, SchemaDiff, StaleSessionCleanup, AuditRetentionCleanup, AuditExport}

type Job struct {
	Kind             Kind           `json:"kind"`
	TargetServerID   string         `json:"targetServerId"`
	PreviousSnapshot []ToolSnapshot `json:"previousSnapshot,omitempty"`
	CurrentSnapshot  []ToolSnapshot `json:"currentSnapshot,omitempty"`
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
	if len(jobs) == 0 {
		jobs = []Job{{Kind: HealthCheck, TargetServerID: db.EchoServerID}, {Kind: ToolScan, TargetServerID: db.EchoServerID}, {Kind: SchemaDiff, TargetServerID: db.EchoServerID}}
	}
	results := make([]Result, 0, len(jobs))
	for _, job := range jobs {
		results = append(results, r.run(ctx, job))
	}
	return results
}

func (r *Registry) run(ctx context.Context, job Job) Result {
	started := db.Now()
	result := Result{Job: job, Status: "success", StartedAt: started, Metadata: map[string]interface{}{"attempt": 1}}
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
		r.store.UpsertHealth(db.ServerHealth{ServerID: job.TargetServerID, Status: "healthy", LatencyMS: 10})
		r.store.AddAudit(db.AuditEvent{EventType: "health.changed", ServerID: job.TargetServerID, RiskLevel: db.RiskLow, PolicyDecision: db.PolicyAllow, TraceID: db.NewID(), MetadataJSON: map[string]interface{}{"jobKind": job.Kind, "status": "healthy"}})
	case ToolScan, ResourceScan, PromptScan, SchemaSnapshot:
		r.store.AddAudit(db.AuditEvent{EventType: "scan.completed", ServerID: job.TargetServerID, RiskLevel: db.RiskLow, PolicyDecision: db.PolicyAllow, TraceID: db.NewID(), MetadataJSON: map[string]interface{}{"jobKind": job.Kind}})
	case SchemaDiff:
		diffs := DiffToolSnapshots(job.PreviousSnapshot, job.CurrentSnapshot)
		r.store.AddAudit(db.AuditEvent{EventType: "schema.changed", ServerID: job.TargetServerID, RiskLevel: db.RiskLow, PolicyDecision: db.PolicyAllow, TraceID: db.NewID(), MetadataJSON: map[string]interface{}{"jobKind": job.Kind, "diffCount": len(diffs), "approvalRequired": approvalRequired(diffs)}})
		result.Metadata["diffCount"] = len(diffs)
		result.Metadata["approvalRequired"] = approvalRequired(diffs)
	case StaleSessionCleanup, AuditRetentionCleanup, AuditExport:
		r.store.AddAudit(db.AuditEvent{EventType: "maintenance.completed", ServerID: job.TargetServerID, RiskLevel: db.RiskLow, PolicyDecision: db.PolicyAllow, TraceID: db.NewID(), MetadataJSON: map[string]interface{}{"jobKind": job.Kind}})
	default:
		result.Status = "failed"
		result.FailureReason = fmt.Sprintf("unsupported job kind %s", job.Kind)
	}
	result.FinishedAt = db.Now()
	return result
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
func high(risk db.RiskLevel) bool { return risk == db.RiskHigh || risk == db.RiskCritical }
func approvalRequired(diffs []Diff) bool {
	for _, diff := range diffs {
		if diff.ApprovalRequired {
			return true
		}
	}
	return false
}
