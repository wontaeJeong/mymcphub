import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

import type { JsonRpcId, McpJsonRpcRequest, McpJsonRpcResponse } from "@mcp-hub/mcp-protocol";

import { createAuditBase, createAuditRecorder, hashArguments, redactArguments } from "./audit";
import { validateBearerToken } from "./auth";
import { allowedToolsForPrincipal, authorizeToolCall } from "./policy";
import { createDefaultRegistry, findServerBySlug } from "./registry";
import { CircuitBreaker, createLocalEchoTransport, withTimeout, type UpstreamTransport } from "./upstream";
import type { GatewayAuditEvent, GatewayPrincipal, GatewayServer } from "./types";

export type GatewayRuntimeOptions = {
  registry?: GatewayServer[];
  upstream?: UpstreamTransport;
  timeoutMs?: number;
  circuitBreaker?: CircuitBreaker;
};

export function createGatewayRuntime(options: GatewayRuntimeOptions = {}) {
  const registry = options.registry ?? createDefaultRegistry();
  const upstream = options.upstream ?? createLocalEchoTransport();
  const timeoutMs = options.timeoutMs ?? 2_000;
  const circuitBreaker = options.circuitBreaker ?? new CircuitBreaker();
  const audit = createAuditRecorder();

  async function handle(request: IncomingMessage, response: ServerResponse) {
    const startedAt = Date.now();
    const url = new URL(request.url ?? "/", "http://localhost");
    const match = /^\/mcp\/([^/]+)$/.exec(url.pathname);

    if (!match) {
      sendJson(response, 404, { error: "not_found" });
      return;
    }

    const principal = validateBearerToken(request);
    if (!principal) {
      sendJson(response, 401, { error: "missing_or_invalid_bearer_token" });
      return;
    }

    const server = findServerBySlug(registry, match[1] ?? "");
    if (!server) {
      sendJson(response, 404, { error: "mcp_server_not_found" });
      return;
    }

    if (!server.enabled) {
      recordHttpAudit(audit.events, principal, server, "http", "deny", startedAt, "MCP_SERVER_DISABLED");
      sendJson(response, 403, { error: "mcp_server_disabled" });
      return;
    }

    if (request.method === "GET") {
      sendJson(response, 200, {
        server: { id: server.id, slug: server.slug, transport: server.transport },
        circuitState: circuitBreaker.state(server.slug)
      });
      return;
    }

    if (request.method !== "POST") {
      sendJson(response, 405, { error: "method_not_allowed" });
      return;
    }

    const parsed = parseJsonRpcRequest(await readJsonBody(request));
    const reply = await handleMcpMessage(parsed, principal, server, upstream, audit.record, circuitBreaker, timeoutMs, startedAt);
    sendJson(response, reply.statusCode, reply.body);
  }

  return {
    auditEvents: audit.events,
    handle,
    metrics: audit.metrics,
    registry
  };
}

async function handleMcpMessage(
  request: McpJsonRpcRequest,
  principal: GatewayPrincipal,
  server: GatewayServer,
  upstream: UpstreamTransport,
  recordAudit: (input: Omit<GatewayAuditEvent, "createdAt" | "traceId"> & { traceId?: string }) => void,
  circuitBreaker: CircuitBreaker,
  timeoutMs: number,
  startedAt: number
): Promise<{ statusCode: number; body: McpJsonRpcResponse | Record<string, unknown> }> {
  const method = request.method;
  const toolName = readToolName(request);
  const redacted = redactArguments(request.params?.arguments);
  const auditBase = createAuditBase(principal, server, method);

  if (method === "notifications/initialized") {
    recordAudit({ ...auditBase, latencyMs: Date.now() - startedAt, policyDecision: "allow" });
    return { statusCode: 202, body: { accepted: true } };
  }

  if (method === "tools/list") {
    const allowedTools = allowedToolsForPrincipal(server, principal);
    recordAudit({ ...auditBase, latencyMs: Date.now() - startedAt, policyDecision: "allow" });
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
    const decision = authorizeToolCall(server, principal, tool);

    if (decision.effect !== "allow") {
      recordAudit({
        ...auditBase,
        argumentHash: hashArguments(redacted),
        argumentRedactedJson: redacted,
        errorCode: "MCP_TOOL_DENIED",
        latencyMs: Date.now() - startedAt,
        policyDecision: decision.effect,
        toolName
      });
      return { statusCode: 200, body: error(request.id, -32001, decision.reason) };
    }
  }

  if (circuitBreaker.state(server.slug) === "degraded") {
    recordAudit({ ...auditBase, errorCode: "UPSTREAM_DEGRADED", latencyMs: Date.now() - startedAt, policyDecision: "deny", toolName });
    return { statusCode: 503, body: error(request.id, -32002, "Upstream is degraded") };
  }

  try {
    const upstreamResponse = await withTimeout(upstream.call(server, request, timeoutMs), timeoutMs);
    circuitBreaker.recordSuccess(server.slug);
    recordAudit({
      ...auditBase,
      argumentHash: hashArguments(redacted),
      argumentRedactedJson: redacted,
      latencyMs: Date.now() - startedAt,
      policyDecision: "allow",
      toolName,
      upstreamStatus: 200
    });
    return { statusCode: 200, body: upstreamResponse };
  } catch (caught: unknown) {
    circuitBreaker.recordFailure(server.slug);
    const message = caught instanceof Error ? caught.message : "UPSTREAM_ERROR";
    recordAudit({ ...auditBase, errorCode: message, latencyMs: Date.now() - startedAt, policyDecision: "deny", toolName });
    return { statusCode: 502, body: error(request.id, -32003, message) };
  }
}

function parseJsonRpcRequest(body: unknown): McpJsonRpcRequest {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { jsonrpc: "2.0", id: null, method: "invalid" };
  }

  const record = body as Record<string, unknown>;
  const id = isJsonRpcId(record.id) ? record.id : undefined;
  const params = record.params && typeof record.params === "object" && !Array.isArray(record.params) ? (record.params as Record<string, unknown>) : undefined;

  return {
    jsonrpc: "2.0",
    id,
    method: typeof record.method === "string" ? record.method : "invalid",
    params
  };
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
    return {};
  }

  return JSON.parse(body) as unknown;
}

function sendJson(response: ServerResponse, statusCode: number, payload: Record<string, unknown> | McpJsonRpcResponse) {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(payload));
}

function recordHttpAudit(
  events: GatewayAuditEvent[],
  principal: GatewayPrincipal,
  server: GatewayServer,
  method: string,
  policyDecision: GatewayAuditEvent["policyDecision"],
  startedAt: number,
  errorCode?: string
) {
  events.unshift({
    traceId: randomUUID(),
    sessionId: `${principal.clientId}:${server.slug}`,
    userId: principal.userId,
    clientId: principal.clientId,
    serverId: server.id,
    method,
    policyDecision,
    latencyMs: Date.now() - startedAt,
    errorCode,
    createdAt: new Date().toISOString()
  });
}
