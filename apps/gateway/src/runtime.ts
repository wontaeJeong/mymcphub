import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

import { createLogger, withSpan } from "@mcp-hub/logger";
import type { JsonRpcId, McpJsonRpcRequest, McpJsonRpcResponse } from "@mcp-hub/mcp-protocol";
import type { PolicyDecision, PolicyEffect } from "@mcp-hub/policy";

import { createAuditBase, createAuditRecorder, hashArguments, redactArguments, riskLevelForGatewayEvent } from "./audit";
import { validateBearerToken } from "./auth";
import { createGatewayPrometheusMetrics, type GatewayPrometheusMetrics } from "./metrics";
import {
  allowedToolsForPrincipal,
  authorizeAdminAction,
  authorizeConnect,
  authorizePromptGet,
  authorizeResourceRead,
  authorizeToolCall,
  authorizeToolDiscovery
} from "./policy";
import { createDefaultRegistry, findServerBySlug } from "./registry";
import { CircuitBreaker, createHttpJsonRpcTransport, withTimeout, type UpstreamTransport } from "./upstream";
import type { GatewayAuditEvent, GatewayPrincipal, GatewayServer } from "./types";

export type GatewayRuntimeOptions = {
  registry?: GatewayServer[];
  upstream?: UpstreamTransport;
  timeoutMs?: number;
  circuitBreaker?: CircuitBreaker;
};

type RequestContext = {
  traceId: string;
  startedAt: number;
  route: "mcp" | "metrics" | "unknown";
  policyDecision: PolicyEffect | "none";
  statusCode: number;
};

type RecordAudit = (input: Omit<GatewayAuditEvent, "createdAt">) => void;

const logger = createLogger("gateway");

export function createGatewayRuntime(options: GatewayRuntimeOptions = {}) {
  const registry = options.registry ?? createDefaultRegistry();
  const upstream = options.upstream ?? createHttpJsonRpcTransport();
  const timeoutMs = options.timeoutMs ?? 2_000;
  const circuitBreaker = options.circuitBreaker ?? new CircuitBreaker();
  const audit = createAuditRecorder();
  const prometheus = createGatewayPrometheusMetrics();

  async function handle(request: IncomingMessage, response: ServerResponse) {
    const context: RequestContext = {
      traceId: readTraceId(request),
      startedAt: Date.now(),
      route: "unknown",
      policyDecision: "none",
      statusCode: 500
    };
    response.setHeader("x-trace-id", context.traceId);
    prometheus.incrementActiveSessions();

    const recordAudit: RecordAudit = (input) => {
      context.policyDecision = input.policyDecision;
      void withSpan("gateway", "mcp.gateway.audit_write", { event_type: input.eventType, policy_decision: input.policyDecision }, () => {
        audit.record(input);
      });
      if (input.policyDecision !== "allow") {
        prometheus.recordPolicyDeny(input.policyDecision);
      }
      if (input.errorCode?.startsWith("UPSTREAM")) {
        prometheus.recordUpstreamError("error");
      }
    };

    try {
      await withSpan("gateway", "mcp.gateway.request", { method: normalizeHttpMethod(request.method) }, () =>
        routeRequest(request, response, context, registry, upstream, recordAudit, circuitBreaker, timeoutMs, prometheus)
      );
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : "GATEWAY_INTERNAL_ERROR";
      sendJson(response, context, 500, { error: "gateway_internal_error" });
      logger.error("gateway request failed", { traceId: context.traceId, errorCode: message });
    } finally {
      const latencyMs = Date.now() - context.startedAt;
      const outcome = context.statusCode >= 200 && context.statusCode < 400 ? "success" : "error";
      prometheus.recordHttpRequest({
        method: normalizeHttpMethod(request.method),
        route: context.route,
        statusCode: context.statusCode,
        latencyMs,
        outcome,
        policyDecision: context.policyDecision
      });
      prometheus.decrementActiveSessions();
      logger.info("gateway request completed", {
        traceId: context.traceId,
        method: normalizeHttpMethod(request.method),
        route: context.route,
        statusCode: context.statusCode,
        latencyMs,
        outcome,
        policyDecision: context.policyDecision
      });
    }
  }

  return {
    auditEvents: audit.events,
    handle,
    metrics: audit.metrics,
    prometheus,
    registry
  };
}

async function routeRequest(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  registry: GatewayServer[],
  upstream: UpstreamTransport,
  recordAudit: RecordAudit,
  circuitBreaker: CircuitBreaker,
  timeoutMs: number,
  prometheus: GatewayPrometheusMetrics
) {
  const url = new URL(request.url ?? "/", "http://localhost");

  if (url.pathname === "/metrics") {
    context.route = "metrics";
    sendText(response, context, 200, prometheus.contentType, await prometheus.render());
    return;
  }

  const match = /^\/mcp\/([^/]+)$/.exec(url.pathname);
  if (!match) {
    recordAudit({
      eventType: "server.connect.denied",
      traceId: context.traceId,
      method: normalizeHttpMethod(request.method),
      riskLevel: "low",
      policyDecision: "deny",
      latencyMs: elapsed(context),
      errorCode: "GATEWAY_ROUTE_NOT_FOUND"
    });
    sendJson(response, context, 404, { error: "not_found" });
    return;
  }

  context.route = "mcp";
  const principal = await withSpan("gateway", "mcp.gateway.auth", { route: context.route }, () => validateBearerToken(request));
  if (!principal) {
    recordAudit({
      eventType: "auth.failure",
      traceId: context.traceId,
      method: normalizeHttpMethod(request.method),
      riskLevel: "low",
      policyDecision: "deny",
      latencyMs: elapsed(context),
      errorCode: "AUTH_MISSING_OR_INVALID_BEARER_TOKEN"
    });
    sendJson(response, context, 401, { error: "missing_or_invalid_bearer_token" });
    return;
  }

  recordAudit({
    eventType: "auth.success",
    traceId: context.traceId,
    method: normalizeHttpMethod(request.method),
    riskLevel: "low",
    policyDecision: "allow",
    latencyMs: elapsed(context),
    userId: principal.userId,
    clientId: principal.clientId
  });

  const serverSlug = match[1] ?? "";
  const server = findServerBySlug(registry, serverSlug);
  if (!server) {
    recordAudit({
      eventType: "server.connect.denied",
      traceId: context.traceId,
      method: normalizeHttpMethod(request.method),
      riskLevel: "low",
      policyDecision: "deny",
      latencyMs: elapsed(context),
      errorCode: "MCP_SERVER_NOT_FOUND",
      userId: principal.userId,
      clientId: principal.clientId
    });
    sendJson(response, context, 404, { error: "mcp_server_not_found" });
    return;
  }

  const connectMethod = request.method === "POST" ? "connect" : normalizeHttpMethod(request.method);
  const auditBase = createAuditBase(principal, server, connectMethod, context.traceId);

  if (!server.enabled) {
    recordAudit({
      ...auditBase,
      eventType: "server.disabled",
      policyDecision: "deny",
      latencyMs: elapsed(context),
      errorCode: "MCP_SERVER_DISABLED"
    });
    sendJson(response, context, 403, { error: "mcp_server_disabled" });
    return;
  }

  const connectDecision = withSpan("gateway", "mcp.gateway.policy_decision", { policy_action: "connect" }, () => authorizeConnect(server, principal));
  const resolvedConnectDecision = await connectDecision;
  if (resolvedConnectDecision.effect !== "allow") {
    recordAudit({
      ...auditBase,
      eventType: "server.connect.denied",
      policyDecision: resolvedConnectDecision.effect,
      latencyMs: elapsed(context),
      errorCode: resolvedConnectDecision.reasonCode
    });
    sendJson(response, context, 403, { error: "mcp_server_denied", reason: resolvedConnectDecision.reason });
    return;
  }

  recordAudit({
    ...auditBase,
    eventType: "server.connect.allowed",
    policyDecision: "allow",
    latencyMs: elapsed(context)
  });

  if (request.method === "GET") {
    sendJson(response, context, 200, {
      server: { id: server.id, slug: server.slug, transport: server.transport },
      circuitState: circuitBreaker.state(server.slug)
    });
    return;
  }

  if (request.method !== "POST") {
    recordAudit({
      ...createAuditBase(principal, server, normalizeHttpMethod(request.method), context.traceId),
      eventType: "server.connect.denied",
      policyDecision: "deny",
      latencyMs: elapsed(context),
      errorCode: "METHOD_NOT_ALLOWED"
    });
    sendJson(response, context, 405, { error: "method_not_allowed" });
    return;
  }

  let parsed: McpJsonRpcRequest;
  try {
    parsed = parseJsonRpcRequest(await readJsonBody(request));
  } catch (caught: unknown) {
    if (caught instanceof JsonRpcRequestError) {
      recordAudit({
        ...createAuditBase(principal, server, "jsonrpc", context.traceId),
        eventType: "tool.call.failed",
        policyDecision: "deny",
        latencyMs: elapsed(context),
        errorCode: caught.code === -32700 ? "JSON_RPC_PARSE_ERROR" : "JSON_RPC_INVALID_REQUEST"
      });
      sendJson(response, context, 400, error(caught.id, caught.code, caught.message));
      return;
    }
    throw caught;
  }

  const reply = await handleMcpMessage(parsed, principal, server, upstream, recordAudit, circuitBreaker, timeoutMs, context, prometheus);
  sendJson(response, context, reply.statusCode, reply.body);
}

async function handleMcpMessage(
  request: McpJsonRpcRequest,
  principal: GatewayPrincipal,
  server: GatewayServer,
  upstream: UpstreamTransport,
  recordAudit: RecordAudit,
  circuitBreaker: CircuitBreaker,
  timeoutMs: number,
  context: RequestContext,
  prometheus: GatewayPrometheusMetrics
): Promise<{ statusCode: number; body: McpJsonRpcResponse | Record<string, unknown> }> {
  const method = request.method;
  const toolName = readToolName(request);
  const redacted = redactArguments(request.params?.arguments);
  const auditBase = createAuditBase(principal, server, method, context.traceId);

  if (method === "notifications/initialized") {
    recordAudit({ ...auditBase, eventType: "server.connect.allowed", latencyMs: elapsed(context), policyDecision: "allow" });
    return { statusCode: 202, body: { accepted: true } };
  }

  if (method === "tools/list") {
    const decision = await withSpan("gateway", "mcp.gateway.policy_decision", { policy_action: "tools/list" }, () => authorizeToolDiscovery(server, principal));
    if (decision.effect !== "allow") {
      recordAudit({
        ...auditBase,
        eventType: "tool.discovery.filtered",
        errorCode: decision.reasonCode,
        latencyMs: elapsed(context),
        policyDecision: decision.effect
      });
      return { statusCode: 200, body: error(request.id, -32001, decision.reason) };
    }
    const allowedTools = allowedToolsForPrincipal(server, principal);
    recordAudit({
      ...auditBase,
      eventType: allowedTools.length === server.tools.length ? "tool.discovery.allowed" : "tool.discovery.filtered",
      latencyMs: elapsed(context),
      policyDecision: decision.effect
    });
    return {
      statusCode: 200,
      body: result(request.id, {
        tools: allowedTools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        }))
      })
    };
  }

  if (method === "tools/call") {
    const tool = server.tools.find((candidate) => candidate.name === toolName);
    const decision = await withSpan("gateway", "mcp.gateway.policy_decision", { policy_action: "tools/call" }, () => authorizeToolCall(server, principal, tool));

    if (decision.effect !== "allow") {
      recordAudit({
        ...auditBase,
        argumentHash: hashArguments(redacted),
        argumentRedactedJson: redacted,
        eventType: "tool.call.denied",
        errorCode: "MCP_TOOL_DENIED",
        latencyMs: elapsed(context),
        policyDecision: decision.effect,
        riskLevel: riskLevelForGatewayEvent(server, toolName),
        toolName
      });
      prometheus.recordToolCall({ latencyMs: elapsed(context), outcome: "error", policyDecision: decision.effect });
      return { statusCode: 200, body: error(request.id, -32001, decision.reason) };
    }

    recordAudit({
      ...auditBase,
      argumentHash: hashArguments(redacted),
      argumentRedactedJson: redacted,
      eventType: "tool.call.allowed",
      latencyMs: elapsed(context),
      policyDecision: "allow",
      riskLevel: riskLevelForGatewayEvent(server, toolName),
      toolName
    });
  }

  const methodDecision = await withSpan("gateway", "mcp.gateway.policy_decision", { policy_action: method }, () => authorizeAdditionalMethod(method, server, principal));
  if (methodDecision?.effect !== "allow") {
    const policyDecision = methodDecision?.effect ?? "deny";
    recordAudit({
      ...auditBase,
      argumentHash: hashArguments(redacted),
      argumentRedactedJson: redacted,
      eventType: method === "tools/call" ? "tool.call.denied" : "server.connect.denied",
      errorCode: methodDecision?.reasonCode ?? "MCP_METHOD_UNSUPPORTED",
      latencyMs: elapsed(context),
      policyDecision,
      riskLevel: riskLevelForGatewayEvent(server, toolName),
      toolName
    });
    if (method === "tools/call") {
      prometheus.recordToolCall({ latencyMs: elapsed(context), outcome: "error", policyDecision });
    }
    return {
      statusCode: 200,
      body: error(request.id, methodDecision ? -32001 : -32601, methodDecision?.reason ?? `Unsupported MCP method ${method}`)
    };
  }

  if (circuitBreaker.state(server.slug) === "degraded") {
    recordAudit({
      ...auditBase,
      eventType: method === "tools/call" ? "tool.call.failed" : "server.connect.denied",
      errorCode: "UPSTREAM_DEGRADED",
      latencyMs: elapsed(context),
      policyDecision: "deny",
      riskLevel: riskLevelForGatewayEvent(server, toolName),
      toolName
    });
    if (method === "tools/call") {
      prometheus.recordToolCall({ latencyMs: elapsed(context), outcome: "error", policyDecision: "deny" });
    }
    return { statusCode: 503, body: error(request.id, -32002, "Upstream is degraded") };
  }

  try {
    const upstreamResponse = await withSpan("gateway", "mcp.gateway.upstream_call", { mcp_method: method }, () =>
      withTimeout(upstream.call(server, request, timeoutMs, context.traceId), timeoutMs)
    );
    circuitBreaker.recordSuccess(server.slug);
    recordAudit({
      ...auditBase,
      argumentHash: hashArguments(redacted),
      argumentRedactedJson: redacted,
      eventType: method === "tools/call" ? "tool.call.succeeded" : "server.connect.allowed",
      latencyMs: elapsed(context),
      policyDecision: "allow",
      riskLevel: riskLevelForGatewayEvent(server, toolName),
      toolName,
      upstreamStatus: 200
    });
    if (method === "tools/call") {
      prometheus.recordToolCall({ latencyMs: elapsed(context), outcome: "success", policyDecision: "allow" });
    }
    return { statusCode: 200, body: upstreamResponse };
  } catch (caught: unknown) {
    circuitBreaker.recordFailure(server.slug);
    const message = caught instanceof Error ? caught.message : "UPSTREAM_ERROR";
    recordAudit({
      ...auditBase,
      eventType: method === "tools/call" ? "tool.call.failed" : "server.connect.denied",
      errorCode: message,
      latencyMs: elapsed(context),
      policyDecision: "deny",
      riskLevel: riskLevelForGatewayEvent(server, toolName),
      toolName
    });
    if (method === "tools/call") {
      prometheus.recordToolCall({ latencyMs: elapsed(context), outcome: "error", policyDecision: "deny" });
    }
    return { statusCode: 502, body: error(request.id, -32003, message) };
  }
}

function authorizeAdditionalMethod(
  method: string,
  server: GatewayServer,
  principal: GatewayPrincipal
): PolicyDecision | undefined {
  if (method === "tools/list" || method === "tools/call" || method === "notifications/initialized") {
    return { ...allowConnectDecision, matchedGrantIds: [] };
  }
  if (method === "initialize" || method === "ping") {
    return { ...allowConnectDecision, matchedGrantIds: [] };
  }
  if (method === "resources/read") {
    return authorizeResourceRead(server, principal);
  }
  if (method === "prompts/get") {
    return authorizePromptGet(server, principal);
  }
  if (method.startsWith("admin/")) {
    return authorizeAdminAction(server, principal);
  }

  return undefined;
}

const allowConnectDecision: PolicyDecision = {
  effect: "allow",
  allowed: true,
  reason: "MCP method is covered by the server connect authorization.",
  reasonCode: "ALLOW",
  matchedGrantIds: [],
  requiresApproval: false,
  requiresStepUp: false
};

function parseJsonRpcRequest(body: unknown): McpJsonRpcRequest {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new JsonRpcRequestError(-32600, "Invalid Request");
  }

  const record = body as Record<string, unknown>;
  const id = readRequestId(record.id);
  const params = readRequestParams(record.params);

  if (record.jsonrpc !== "2.0" || typeof record.method !== "string") {
    throw new JsonRpcRequestError(-32600, "Invalid Request", id);
  }

  return {
    jsonrpc: "2.0",
    id,
    method: record.method,
    params
  };
}

function readRequestId(value: unknown): JsonRpcId | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isJsonRpcId(value)) {
    throw new JsonRpcRequestError(-32600, "Invalid Request");
  }

  return value;
}

function readRequestParams(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new JsonRpcRequestError(-32600, "Invalid Request");
  }

  return value as Record<string, unknown>;
}

function isJsonRpcId(value: unknown): value is JsonRpcId {
  return value === null || typeof value === "string" || typeof value === "number";
}

function readToolName(request: McpJsonRpcRequest) {
  return typeof request.params?.name === "string" ? request.params.name : undefined;
}

function result(id: JsonRpcId | undefined, payload: Record<string, unknown>): McpJsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    result: payload
  };
}

function error(id: JsonRpcId | undefined, code: number, message: string): McpJsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message }
  };
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  const body = Buffer.concat(chunks).toString("utf8");
  if (body.length === 0) {
    throw new JsonRpcRequestError(-32600, "Invalid Request");
  }

  try {
    return JSON.parse(body) as unknown;
  } catch (caught: unknown) {
    if (caught instanceof SyntaxError) {
      throw new JsonRpcRequestError(-32700, "Parse error");
    }
    throw caught;
  }
}

function sendJson(
  response: ServerResponse,
  context: RequestContext,
  statusCode: number,
  payload: Record<string, unknown> | McpJsonRpcResponse
) {
  sendText(response, context, statusCode, "application/json", JSON.stringify(payload));
}

function sendText(response: ServerResponse, context: RequestContext, statusCode: number, contentType: string, payload: string) {
  context.statusCode = statusCode;
  response.statusCode = statusCode;
  response.setHeader("content-type", contentType);
  response.end(payload);
}

function readTraceId(request: IncomingMessage) {
  const header = firstHeader(request.headers["x-trace-id"]);
  return header && header.trim().length > 0 ? header.trim() : randomUUID();
}

function firstHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeHttpMethod(method: string | undefined) {
  return method ?? "UNKNOWN";
}

function elapsed(context: RequestContext) {
  return Date.now() - context.startedAt;
}

class JsonRpcRequestError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly id: JsonRpcId | undefined = null
  ) {
    super(message);
  }
}
