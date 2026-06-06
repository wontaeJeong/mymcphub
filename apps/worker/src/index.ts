import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { createLogger, withSpan } from "@mcp-hub/logger";
import { getWorkerMetricsText, recordWorkerScan, recordWorkerSchemaChange } from "./metrics.js";
import { diffToolSnapshots, type ToolSnapshot, type ToolSchemaDiffType } from "./schema-diff.js";

export type WorkerJobKind = "tool-scan" | "schema-diff" | "health-check";

type BaseWorkerJob = {
  kind: WorkerJobKind;
  targetServerId: string;
};

export type SchemaDiffWorkerJob = BaseWorkerJob & {
  kind: "schema-diff";
  previousSnapshot?: ToolSnapshot[];
  currentSnapshot?: ToolSnapshot[];
};

export type WorkerJob = SchemaDiffWorkerJob | (BaseWorkerJob & { kind: "tool-scan" | "health-check" });

export const defaultWorkerJobs: WorkerJobKind[] = [
  "tool-scan",
  "schema-diff",
  "health-check"
];

export type RunWorkerOnceOptions = {
  traceId?: string;
};

export type RunWorkerOnceResult = {
  processed: number;
  supportedJobs: WorkerJobKind[];
  traceId: string;
};

export type WorkerAuditEvent = {
  eventType: "schema.changed" | "health.changed";
  traceId: string;
  serverId: string;
  timestamp: string;
  outcome: "success";
  metadata: Record<string, string | number | boolean>;
};

const logger = createLogger("worker");

const workerAuditEvents: WorkerAuditEvent[] = [];

const workerSpanNames: Record<WorkerJobKind, string> = {
  "health-check": "mcp.worker.health_check",
  "schema-diff": "mcp.worker.schema_diff",
  "tool-scan": "mcp.worker.tool_scan"
};

async function processWorkerJob(job: WorkerJob, traceId: string) {
  await withSpan("worker", workerSpanNames[job.kind], { job_kind: job.kind }, () => {
    recordWorkerScan(job.kind);

    if (job.kind === "schema-diff") {
      processSchemaDiffJob(job, traceId);
    }

    if (job.kind === "health-check") {
      recordWorkerAuditEvent("health.changed", job, traceId, { status: "healthy" });
    }

    logger.info("worker job processed", {
      jobKind: job.kind,
      traceId
    });
  });
}

function processSchemaDiffJob(job: SchemaDiffWorkerJob, traceId: string) {
  if (!job.previousSnapshot || !job.currentSnapshot) {
    recordWorkerAuditEvent("schema.changed", job, traceId, {
      placeholder: true,
      reason: "runtime MCP tools/list scanning is not implemented"
    });
    return;
  }

  const diffs = diffToolSnapshots(job.previousSnapshot, job.currentSnapshot);
  const diffTypes = summarizeDiffTypes(diffs.map((diff) => diff.type));
  const approvalRequired = diffs.some((diff) => diff.metadata.approvalRequired);

  if (diffs.length > 0) {
    recordWorkerSchemaChange(job.kind);
  }

  recordWorkerAuditEvent("schema.changed", job, traceId, {
    changed: diffs.length > 0,
    diffCount: diffs.length,
    diffTypes,
    approvalRequired
  });
}

function summarizeDiffTypes(diffTypes: ToolSchemaDiffType[]) {
  return [...new Set(diffTypes)].join(",");
}

export function getWorkerAuditEvents() {
  return workerAuditEvents;
}

export function resetWorkerAuditEventsForTests() {
  workerAuditEvents.length = 0;
}

export function createWorkerServer() {
  const server = createServer((request, response) => {
    if (request.method === "GET" && request.url === "/metrics") {
      void getWorkerMetricsText().then((metrics) => {
        response.statusCode = 200;
        response.setHeader("content-type", "text/plain; version=0.0.4; charset=utf-8");
        response.end(metrics);
      });
      return;
    }

    response.statusCode = 404;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ error: "not_found" }));
  });

  return { server };
}

function recordWorkerAuditEvent(
  eventType: WorkerAuditEvent["eventType"],
  job: WorkerJob,
  traceId: string,
  metadata: WorkerAuditEvent["metadata"]
) {
  workerAuditEvents.unshift({
    eventType,
    traceId,
    serverId: job.targetServerId,
    timestamp: new Date().toISOString(),
    outcome: "success",
    metadata: { jobKind: job.kind, ...metadata }
  });
}

export async function runWorkerOnce(jobs: WorkerJob[] = [], options: RunWorkerOnceOptions = {}): Promise<RunWorkerOnceResult> {
  const traceId = options.traceId ?? randomUUID();

  for (const job of jobs) {
    await processWorkerJob(job, traceId);
  }

  return {
    processed: jobs.length,
    supportedJobs: defaultWorkerJobs,
    traceId
  };
}

if (process.env.NODE_ENV !== "test" && import.meta.url === `file://${process.argv[1]}`) {
  void runWorkerOnce().then((result) => {
    logger.info("worker run completed", result);
  });
}
