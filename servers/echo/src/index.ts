import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
};

type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  call: (argumentsJson: Record<string, unknown>) => Record<string, unknown>;
};

const serverInfo = { name: "echo", version: "0.1.0" } as const;

export const echoTools: ToolDefinition[] = [
  {
    name: "echo_message",
    description: "Return the provided message unchanged.",
    inputSchema: {
      type: "object",
      properties: { message: { type: "string", description: "Message to echo back." } },
      required: ["message"],
      additionalProperties: false
    },
    call(argumentsJson) {
      const message = argumentsJson.message;
      if (typeof message !== "string") {
        throw new ToolInputError("message must be a string");
      }

      return textResult(message);
    }
  },
  {
    name: "get_server_time",
    description: "Return the current server time as an ISO-8601 timestamp.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    call() {
      return textResult(new Date().toISOString());
    }
  }
];

export async function handleMcpRequest(body: unknown): Promise<JsonRpcResponse> {
  try {
    return handleParsedMcpRequest(parseRequest(body));
  } catch (caught: unknown) {
    if (caught instanceof JsonRpcRequestError) {
      return error(caught.id, caught.code, caught.message);
    }
    throw caught;
  }
}

function handleParsedMcpRequest(request: JsonRpcRequest): JsonRpcResponse {
  if (request.method === "initialize") {
    return result(request.id, {
      protocolVersion: "2025-03-26",
      capabilities: { tools: {}, resources: {}, prompts: {} },
      serverInfo
    });
  }

  if (request.method === "ping") {
    return result(request.id, {});
  }

  if (request.method === "tools/list") {
    return result(request.id, {
      tools: echoTools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }))
    });
  }

  if (request.method === "tools/call") {
    return callTool(request);
  }

  if (request.method === "resources/list") {
    return result(request.id, { resources: [] });
  }

  if (request.method === "prompts/list") {
    return result(request.id, { prompts: [] });
  }

  return error(request.id, -32601, `Method not found: ${request.method}`);
}

export function startEchoServer(port = Number(process.env.PORT ?? 5100)) {
  const server = createServer((request, response) => {
    void handleHttpRequest(request, response);
  });

  server.listen(port);
  return server;
}

async function handleHttpRequest(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? "/", "http://localhost");

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, { status: "ok", server: serverInfo.name });
    return;
  }

  if (request.method === "POST" && url.pathname === "/mcp") {
    try {
      const body = await readJsonBody(request);
      sendJson(response, 200, handleParsedMcpRequest(parseRequest(body)));
    } catch (caught: unknown) {
      if (caught instanceof JsonRpcRequestError) {
        sendJson(response, 400, error(caught.id, caught.code, caught.message));
        return;
      }
      throw caught;
    }
    return;
  }

  sendJson(response, 404, { error: "not_found" });
}

function callTool(request: JsonRpcRequest): JsonRpcResponse {
  const params = readRecord(request.params);
  const toolName = params.name;
  if (typeof toolName !== "string") {
    return error(request.id, -32602, "tools/call requires params.name");
  }

  const tool = echoTools.find((candidate) => candidate.name === toolName);
  if (!tool) {
    return error(request.id, -32601, `Unknown tool: ${toolName}`);
  }

  try {
    return result(request.id, tool.call(readRecord(params.arguments)));
  } catch (caught: unknown) {
    if (caught instanceof ToolInputError) {
      return error(request.id, -32602, caught.message);
    }
    throw caught;
  }
}

function textResult(text: string): Record<string, unknown> {
  return { content: [{ type: "text", text }] };
}

function parseRequest(body: unknown): JsonRpcRequest {
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

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function result(id: JsonRpcId | undefined, payload: Record<string, unknown>): JsonRpcResponse {
  return { jsonrpc: "2.0", id: id ?? null, result: payload };
}

function error(id: JsonRpcId | undefined, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
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

function sendJson(response: ServerResponse, statusCode: number, payload: Record<string, unknown> | JsonRpcResponse) {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(payload));
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

class ToolInputError extends Error {}

if (process.env.NODE_ENV !== "test" && import.meta.url === `file://${process.argv[1]}`) {
  startEchoServer();
}
