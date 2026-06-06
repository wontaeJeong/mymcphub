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

type InternalDoc = {
  id: string;
  title: string;
  body: string;
};

type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  call: (argumentsJson: Record<string, unknown>) => Record<string, unknown>;
};

const serverInfo = { name: "internal-docs", version: "0.1.0" } as const;

export const internalDocuments: InternalDoc[] = [
  {
    id: "gateway-runbook",
    title: "Gateway Runbook",
    body: "The MCP Gateway proxies approved JSON-RPC tool calls to registered upstream servers. Operators should check /health, audit events, and circuit breaker state before restarting the service."
  },
  {
    id: "grant-policy",
    title: "Grant Policy",
    body: "Platform team grants should include only the tools required by the requesting project. High and critical risk tools require approval before production use."
  },
  {
    id: "first-party-servers",
    title: "First-party Servers",
    body: "First-party MCP servers run as local TypeScript HTTP services during development. Each server exposes /health and /mcp and publishes a manifest with read-only risk metadata."
  }
];

export const internalDocsTools: ToolDefinition[] = [
  {
    name: "search_docs",
    description: "Search synthetic internal documentation by keyword and return deterministic snippets.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query." },
        limit: { type: "number", minimum: 1, maximum: 10, description: "Maximum number of results." }
      },
      required: ["query"],
      additionalProperties: false
    },
    call(argumentsJson) {
      const query = argumentsJson.query;
      if (typeof query !== "string" || query.trim().length === 0) {
        throw new ToolInputError("query must be a non-empty string");
      }

      const limit = readLimit(argumentsJson.limit);
      const normalizedQuery = query.trim().toLowerCase();
      const results = internalDocuments
        .filter((document) => `${document.title} ${document.body}`.toLowerCase().includes(normalizedQuery))
        .slice(0, limit)
        .map((document) => ({ docId: document.id, title: document.title, snippet: createSnippet(document, normalizedQuery) }));

      return { content: [{ type: "text", text: JSON.stringify({ results }) }] };
    }
  },
  {
    name: "read_doc",
    description: "Read one synthetic internal document by id.",
    inputSchema: {
      type: "object",
      properties: { docId: { type: "string", description: "Document id returned by search_docs." } },
      required: ["docId"],
      additionalProperties: false
    },
    call(argumentsJson) {
      const docId = argumentsJson.docId;
      if (typeof docId !== "string" || docId.trim().length === 0) {
        throw new ToolInputError("docId must be a non-empty string");
      }

      const document = internalDocuments.find((candidate) => candidate.id === docId);
      if (!document) {
        throw new ToolInputError(`Unknown document: ${docId}`);
      }

      return { content: [{ type: "text", text: JSON.stringify(document) }] };
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
      tools: internalDocsTools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }))
    });
  }

  if (request.method === "tools/call") {
    return callTool(request);
  }

  if (request.method === "resources/list") {
    return result(request.id, {
      resources: internalDocuments.map((document) => ({ uri: `internal-docs://${document.id}`, name: document.title }))
    });
  }

  if (request.method === "prompts/list") {
    return result(request.id, { prompts: [] });
  }

  return error(request.id, -32601, `Method not found: ${request.method}`);
}

export function startInternalDocsServer(port = Number(process.env.PORT ?? 5101)) {
  const server = createServer((request, response) => {
    void handleHttpRequest(request, response);
  });

  server.listen(port);
  return server;
}

async function handleHttpRequest(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? "/", "http://localhost");

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, { status: "ok", server: serverInfo.name, documents: internalDocuments.length });
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

  const tool = internalDocsTools.find((candidate) => candidate.name === toolName);
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

function readLimit(value: unknown) {
  if (value === undefined) {
    return 5;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 10) {
    throw new ToolInputError("limit must be an integer from 1 to 10");
  }

  return value;
}

function createSnippet(document: InternalDoc, normalizedQuery: string) {
  const haystack = document.body.toLowerCase();
  const index = haystack.indexOf(normalizedQuery);
  if (index < 0) {
    return document.body.slice(0, 120);
  }

  const start = Math.max(0, index - 30);
  return document.body.slice(start, start + 140);
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
  startInternalDocsServer();
}
