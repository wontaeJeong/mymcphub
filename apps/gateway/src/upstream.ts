import type { McpJsonRpcRequest, McpJsonRpcResponse, McpToolDescriptor } from "@mcp-hub/mcp-protocol";

import type { GatewayServer } from "./types";

export interface UpstreamTransport {
  call(server: GatewayServer, request: McpJsonRpcRequest, timeoutMs: number, traceId: string): Promise<McpJsonRpcResponse>;
}

export type CircuitState = "closed" | "degraded";

export class CircuitBreaker {
  private failures = new Map<string, number>();

  constructor(private readonly threshold = 3) {}

  state(serverSlug: string): CircuitState {
    return (this.failures.get(serverSlug) ?? 0) >= this.threshold ? "degraded" : "closed";
  }

  recordSuccess(serverSlug: string) {
    this.failures.set(serverSlug, 0);
  }

  recordFailure(serverSlug: string) {
    this.failures.set(serverSlug, (this.failures.get(serverSlug) ?? 0) + 1);
  }
}

export function createHttpJsonRpcTransport(): UpstreamTransport {
  return {
    async call(server, request, _timeoutMs, traceId) {
      if (!server.upstreamUrl) {
        throw new Error("UPSTREAM_URL_MISSING");
      }

      if (server.upstreamUrl.startsWith("local://")) {
        return createLocalEchoTransport().call(server, request, 0, traceId);
      }

      const response = await fetch(server.upstreamUrl, {
        method: "POST",
        headers: { "content-type": "application/json", "x-trace-id": traceId },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`UPSTREAM_HTTP_${response.status}`);
      }

      return parseJsonRpcResponse(await response.json());
    }
  };
}

export function createLocalEchoTransport(): UpstreamTransport {
  return {
    async call(server, request) {
      if (request.method === "tools/list") {
        return result(request, { tools: server.tools.map(toMcpToolDescriptor) });
      }

      if (request.method === "tools/call") {
        const params = request.params ?? {};
        const argumentsJson = readRecord(params.arguments);
        return result(request, {
          content: [
            {
              type: "text",
              text: JSON.stringify({ echo: argumentsJson })
            }
          ]
        });
      }

      if (request.method === "initialize") {
        return result(request, {
          protocolVersion: "2025-03-26",
          capabilities: { tools: {}, resources: {}, prompts: {} },
          serverInfo: { name: server.slug, version: "0.1.0" }
        });
      }

      if (request.method === "resources/list") {
        return result(request, { resources: [] });
      }

      if (request.method === "prompts/list") {
        return result(request, { prompts: [] });
      }

      if (request.method === "ping") {
        return result(request, {});
      }

      return result(request, { proxied: true, method: request.method });
    }
  };
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("UPSTREAM_TIMEOUT")), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

function result(request: McpJsonRpcRequest, payload: Record<string, unknown>): McpJsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id: request.id ?? null,
    result: payload
  };
}

function parseJsonRpcResponse(value: unknown): McpJsonRpcResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("UPSTREAM_INVALID_JSON_RPC_RESPONSE");
  }

  const record = value as Record<string, unknown>;
  if (record.jsonrpc !== "2.0") {
    throw new Error("UPSTREAM_INVALID_JSON_RPC_RESPONSE");
  }

  return {
    jsonrpc: "2.0",
    id: isJsonRpcId(record.id) ? record.id : null,
    result: readOptionalRecord(record.result),
    error: readJsonRpcError(record.error)
  };
}

function isJsonRpcId(value: unknown): value is McpJsonRpcResponse["id"] {
  return value === null || typeof value === "string" || typeof value === "number";
}

function readOptionalRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function readJsonRpcError(value: unknown): McpJsonRpcResponse["error"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.code !== "number" || typeof record.message !== "string") {
    return undefined;
  }

  return { code: record.code, message: record.message, data: readOptionalRecord(record.data) };
}

function toMcpToolDescriptor(tool: GatewayServer["tools"][number]): McpToolDescriptor {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema
  };
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
