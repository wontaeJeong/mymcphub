export type JsonRpcId = string | number | null;

export type McpJsonRpcError = {
  code: number;
  message: string;
  data?: Record<string, unknown>;
};

export type McpToolDescriptor = {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
};

export type McpJsonRpcRequest = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
};

export type McpJsonRpcResponse = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: Record<string, unknown>;
  error?: McpJsonRpcError;
};

export type McpJsonRpcMessage = McpJsonRpcRequest | McpJsonRpcResponse;

export const mcpKnownMethods = [
  "initialize",
  "notifications/initialized",
  "tools/list",
  "tools/call",
  "resources/list",
  "resources/read",
  "prompts/list",
  "prompts/get",
  "ping"
] as const;

export type McpKnownMethod = (typeof mcpKnownMethods)[number];

export function serializeStdioJsonRpcFrame(message: McpJsonRpcMessage): string {
  return `${JSON.stringify(message)}\n`;
}

export function parseStdioJsonRpcFrame(line: string): McpJsonRpcMessage {
  const trimmed = line.endsWith("\n") ? line.slice(0, -1) : line;
  if (trimmed.length === 0) {
    throw new Error("STDIO_FRAME_EMPTY");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch (caught: unknown) {
    if (caught instanceof SyntaxError) {
      throw new Error("STDIO_FRAME_PARSE_ERROR");
    }
    throw caught;
  }

  return parseJsonRpcMessage(parsed);
}

export function createJsonRpcResult(id: JsonRpcId | undefined, result: Record<string, unknown>): McpJsonRpcResponse {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

export function createJsonRpcError(
  id: JsonRpcId | undefined,
  code: number,
  message: string,
  data?: Record<string, unknown>
): McpJsonRpcResponse {
  return { jsonrpc: "2.0", id: id ?? null, error: data ? { code, message, data } : { code, message } };
}

export function isJsonRpcRequest(message: McpJsonRpcMessage): message is McpJsonRpcRequest {
  return "method" in message;
}

export function isJsonRpcResponse(message: McpJsonRpcMessage): message is McpJsonRpcResponse {
  return "result" in message || "error" in message;
}

function parseJsonRpcMessage(value: unknown): McpJsonRpcMessage {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("STDIO_FRAME_INVALID_JSON_RPC");
  }

  const record = value as Record<string, unknown>;
  if (record.jsonrpc !== "2.0") {
    throw new Error("STDIO_FRAME_INVALID_JSON_RPC");
  }

  if (typeof record.method === "string") {
    return {
      jsonrpc: "2.0",
      id: readOptionalId(record.id),
      method: record.method,
      params: readOptionalRecord(record.params)
    };
  }

  const id = readRequiredId(record.id);
  const result = readOptionalRecord(record.result);
  const error = readOptionalError(record.error);
  if (result === undefined && error === undefined) {
    throw new Error("STDIO_FRAME_INVALID_JSON_RPC");
  }

  return { jsonrpc: "2.0", id, result, error };
}

function readOptionalId(value: unknown): JsonRpcId | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isJsonRpcId(value)) {
    throw new Error("STDIO_FRAME_INVALID_JSON_RPC");
  }
  return value;
}

function readRequiredId(value: unknown): JsonRpcId {
  if (!isJsonRpcId(value)) {
    throw new Error("STDIO_FRAME_INVALID_JSON_RPC");
  }
  return value;
}

function readOptionalRecord(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("STDIO_FRAME_INVALID_JSON_RPC");
  }
  return value as Record<string, unknown>;
}

function readOptionalError(value: unknown): McpJsonRpcError | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("STDIO_FRAME_INVALID_JSON_RPC");
  }

  const record = value as Record<string, unknown>;
  if (typeof record.code !== "number" || typeof record.message !== "string") {
    throw new Error("STDIO_FRAME_INVALID_JSON_RPC");
  }

  return { code: record.code, message: record.message, data: readOptionalRecord(record.data) };
}

function isJsonRpcId(value: unknown): value is JsonRpcId {
  return value === null || typeof value === "string" || typeof value === "number";
}
