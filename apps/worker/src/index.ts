import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { createLogger, withSpan } from "@mcp-hub/logger";
import { getWorkerMetricsText, recordWorkerScan, recordWorkerSchemaChange } from "./metrics.js";

export type WorkerJobKind = "tool-scan" | "schema-diff" | "health-check";

export type WorkerJob = {
  kind: WorkerJobKind;
  targetServerId: string;
};

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
      recordWorkerSchemaChange(job.kind);
      recordWorkerAuditEvent("schema.changed", job, traceId, { changed: true });
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
