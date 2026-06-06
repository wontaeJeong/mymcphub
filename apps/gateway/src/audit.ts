import { createHash } from "node:crypto";

import type { GatewayAuditEvent, GatewayAuditJsonValue, GatewayMetrics, GatewayPrincipal, GatewayServer } from "./types";

export type AuditRecorder = {
  events: GatewayAuditEvent[];
  metrics: GatewayMetrics;
  record(input: Omit<GatewayAuditEvent, "createdAt">): void;
};

export function createAuditRecorder(): AuditRecorder {
  const metrics: GatewayMetrics = {
    deniedCount: 0,
    requestCount: 0,
    upstreamFailureCount: 0
  };
  const events: GatewayAuditEvent[] = [];

  return {
    events,
    metrics,
    record(input) {
      metrics.requestCount += 1;
      if (input.policyDecision !== "allow") {
        metrics.deniedCount += 1;
      }
      if (input.errorCode?.startsWith("UPSTREAM")) {
        metrics.upstreamFailureCount += 1;
      }

      events.unshift({
        ...input,
        createdAt: new Date().toISOString()
      });
    }
  };
}

export function createAuditBase(principal: GatewayPrincipal, server: GatewayServer, method: string, traceId: string) {
  return {
    clientId: principal.clientId,
    method,
    riskLevel: riskLevelForGatewayEvent(server),
    serverId: server.id,
    sessionId: `${principal.clientId}:${server.slug}`,
    traceId,
    userId: principal.userId
  };
}

const sensitiveKeys = new Set([
  "password",
  "passwd",
  "token",
  "secret",
  "apikey",
  "authorization",
  "cookie",
  "kubeconfig",
  "privatekey"
]);

const redactedValue = "[REDACTED]";

export function redactArguments(value: unknown): GatewayAuditJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  return redactJsonValue(value);
}

export function hashArguments(value: GatewayAuditJsonValue | undefined) {
  if (!value) {
    return undefined;
  }

  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function riskLevelForGatewayEvent(server: GatewayServer, toolName?: string): GatewayAuditEvent["riskLevel"] {
  const tool = toolName ? server.tools.find((candidate) => candidate.name === toolName) : undefined;
  if (tool) {
    return tool.riskLevel;
  }
  if (server.tools.some((candidate) => candidate.riskLevel === "critical")) {
    return "critical";
  }
  if (server.tools.some((candidate) => candidate.riskLevel === "high")) {
    return "high";
  }
  if (server.tools.some((candidate) => candidate.riskLevel === "medium")) {
    return "medium";
  }

  return "low";
}

export function canonicalJson(value: GatewayAuditJsonValue): string {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }

  return `{${Object.entries(value)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, nestedValue]) => `${JSON.stringify(key)}:${canonicalJson(nestedValue ?? null)}`)
    .join(",")}}`;
}

function redactJsonValue(value: unknown): GatewayAuditJsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactJsonValue(item));
  }

  if (typeof value === "object") {
    const redactedRecord: { [key: string]: GatewayAuditJsonValue } = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      redactedRecord[key] = sensitiveKeys.has(key.toLowerCase()) ? redactedValue : redactJsonValue(nestedValue);
    }
    return redactedRecord;
  }

  return null;
}
