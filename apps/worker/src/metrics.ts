import { Counter, Registry } from "prom-client";

export type WorkerMetricJobKind = "tool-scan" | "schema-diff" | "health-check";
export type WorkerMetricOutcome = "success";

const workerMetricsRegistry = new Registry();

const scanTotal = new Counter({
  help: "Total worker scan jobs processed.",
  labelNames: ["job_kind", "outcome"],
  name: "mcp_worker_scan_total",
  registers: [workerMetricsRegistry]
});

const schemaChangesTotal = new Counter({
  help: "Total worker schema changes detected.",
  labelNames: ["job_kind", "outcome"],
  name: "mcp_worker_schema_changes_total",
  registers: [workerMetricsRegistry]
});

export function recordWorkerScan(jobKind: WorkerMetricJobKind, outcome: WorkerMetricOutcome = "success") {
  scanTotal.inc({ job_kind: jobKind, outcome });
}

export function recordWorkerSchemaChange(jobKind: Extract<WorkerMetricJobKind, "schema-diff">, outcome: WorkerMetricOutcome = "success") {
  schemaChangesTotal.inc({ job_kind: jobKind, outcome }, 1);
}

export async function getWorkerMetricsText() {
  return workerMetricsRegistry.metrics();
}

export function resetWorkerMetricsForTests() {
  workerMetricsRegistry.resetMetrics();
}
