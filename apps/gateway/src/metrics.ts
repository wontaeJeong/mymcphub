import { Counter, Gauge, Histogram, Registry } from "prom-client";

import type { GatewayAuditEvent } from "./types";

type RequestMetricInput = {
  method: string;
  route: "mcp" | "metrics" | "unknown";
  statusCode: number;
  latencyMs: number;
  outcome: "success" | "error";
  policyDecision: GatewayAuditEvent["policyDecision"] | "none";
};

type ToolCallMetricInput = {
  latencyMs: number;
  outcome: "success" | "error";
  policyDecision: GatewayAuditEvent["policyDecision"];
};

export type GatewayPrometheusMetrics = {
  contentType: string;
  render(): Promise<string>;
  incrementActiveSessions(): void;
  decrementActiveSessions(): void;
  recordHttpRequest(input: RequestMetricInput): void;
  recordPolicyDeny(policyDecision: GatewayAuditEvent["policyDecision"]): void;
  recordToolCall(input: ToolCallMetricInput): void;
  recordUpstreamError(outcome: "error"): void;
};

export function createGatewayPrometheusMetrics(): GatewayPrometheusMetrics {
  const registry = new Registry();
  const requestLabelNames = ["method", "route", "status_family", "outcome", "policy_decision"] as const;
  const toolLabelNames = ["outcome", "policy_decision"] as const;

  const requestsTotal = new Counter({
    name: "mcp_gateway_requests_total",
    help: "Total Gateway HTTP requests.",
    labelNames: requestLabelNames,
    registers: [registry]
  });
  const requestDuration = new Histogram({
    name: "mcp_gateway_request_duration_ms",
    help: "Gateway HTTP request duration in milliseconds.",
    labelNames: requestLabelNames,
    buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    registers: [registry]
  });
  const toolCallsTotal = new Counter({
    name: "mcp_gateway_tool_calls_total",
    help: "Total MCP tool call attempts handled by the Gateway.",
    labelNames: toolLabelNames,
    registers: [registry]
  });
  const toolCallDuration = new Histogram({
    name: "mcp_gateway_tool_call_duration_ms",
    help: "MCP tool call duration in milliseconds.",
    labelNames: toolLabelNames,
    buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    registers: [registry]
  });
  const policyDeniesTotal = new Counter({
    name: "mcp_gateway_policy_denies_total",
    help: "Total Gateway policy denials.",
    labelNames: ["policy_decision"],
    registers: [registry]
  });
  const upstreamErrorsTotal = new Counter({
    name: "mcp_gateway_upstream_errors_total",
    help: "Total Gateway upstream errors.",
    labelNames: ["outcome"],
    registers: [registry]
  });
  const activeSessions = new Gauge({
    name: "mcp_gateway_active_sessions",
    help: "Current active Gateway HTTP sessions.",
    registers: [registry]
  });

  return {
    contentType: registry.contentType,
    decrementActiveSessions() {
      activeSessions.dec();
    },
    incrementActiveSessions() {
      activeSessions.inc();
    },
    recordHttpRequest(input) {
      const labels = {
        method: input.method,
        route: input.route,
        status_family: statusFamily(input.statusCode),
        outcome: input.outcome,
        policy_decision: input.policyDecision
      };
      requestsTotal.inc(labels);
      requestDuration.observe(labels, input.latencyMs);
    },
    recordPolicyDeny(policyDecision) {
      policyDeniesTotal.inc({ policy_decision: policyDecision });
    },
    recordToolCall(input) {
      const labels = { outcome: input.outcome, policy_decision: input.policyDecision };
      toolCallsTotal.inc(labels);
      toolCallDuration.observe(labels, input.latencyMs);
    },
    recordUpstreamError(outcome) {
      upstreamErrorsTotal.inc({ outcome });
    },
    render() {
      return registry.metrics();
    }
  };
}

function statusFamily(statusCode: number) {
  return `${Math.floor(statusCode / 100)}xx`;
}
