import { createHash, randomUUID } from "node:crypto";

import type { GatewayAuditEvent, GatewayMetrics, GatewayPrincipal, GatewayServer } from "./types";

export type AuditRecorder = {
  events: GatewayAuditEvent[];
  metrics: GatewayMetrics;
  record(input: Omit<GatewayAuditEvent, "createdAt" | "traceId"> & { traceId?: string }): void;
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
        traceId: input.traceId ?? randomUUID(),
        createdAt: new Date().toISOString()
      });
    }
  };
}

export function createAuditBase(principal: GatewayPrincipal, server: GatewayServer, method: string) {
  return {
    clientId: principal.clientId,
    method,
    serverId: server.id,
    sessionId: `${principal.clientId}:${server.slug}`,
    userId: principal.userId
  };
}

export function redactArguments(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return redactRecord(value as Record<string, unknown>);
}

export function hashArguments(value: Record<string, unknown> | undefined) {
  if (!value) {
    return undefined;
  }

  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function redactRecord(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => {
      if (/token|secret|password|key/i.test(key)) {
        return [key, "[REDACTED]"];
      }
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return [key, redactRecord(value as Record<string, unknown>)];
      }
      return [key, value];
    })
  );
}
