import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import { pathToFileURL } from "node:url";

import {
  createJsonRpcError,
  createJsonRpcResult,
  isJsonRpcRequest,
  parseStdioJsonRpcFrame,
  serializeStdioJsonRpcFrame,
  type JsonRpcId,
  type McpJsonRpcRequest,
  type McpJsonRpcResponse,
  type McpToolDescriptor
} from "@mcp-hub/mcp-protocol";

type ToolDefinition = McpToolDescriptor & {
  call: (argumentsJson: Record<string, unknown>) => Record<string, unknown>;
};

const serverInfo = { name: "stdio-sample", version: "0.1.0" } as const;
const startedAt = new Date();

export const stdioSampleTools: ToolDefinition[] = [
  {
    name: "stdio_echo",
    description: "Return the provided message and metadata from the stdio sample server.",
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

      return textJsonResult({ message, transport: "stdio", server: serverInfo.name });
    }
  },
  {
    name: "get_stdio_status",
    description: "Return process and uptime status for the stdio sample server.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    call() {
      return textJsonResult({
        server: serverInfo.name,
        pid: process.pid,
        uptimeMs: Date.now() - startedAt.getTime(),
        startedAt: startedAt.toISOString()
      });
    }
  }
];

export function handleStdioMcpRequest(request: McpJsonRpcRequest): McpJsonRpcResponse | undefined {
  if (request.id === undefined && request.method.startsWith("notifications/")) {
    return undefined;
  }

  if (request.method === "initialize") {
    return createJsonRpcResult(request.id, {
      protocolVersion: "2025-03-26",
      capabilities: { tools: {}, resources: {}, prompts: {} },
      serverInfo
    });
  }

  if (request.method === "ping") {
    return createJsonRpcResult(request.id, {});
  }

  if (request.method === "tools/list") {
    return createJsonRpcResult(request.id, {
      tools: stdioSampleTools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }))
    });
  }

  if (request.method === "tools/call") {
    return callTool(request);
  }

  if (request.method === "resources/list") {
    return createJsonRpcResult(request.id, { resources: [] });
  }

  if (request.method === "prompts/list") {
    return createJsonRpcResult(request.id, { prompts: [] });
  }

  return createJsonRpcError(request.id, -32601, `Method not found: ${request.method}`);
}

export function startStdioSampleServer(input: Readable = process.stdin, output: Writable = process.stdout, diagnostics: Writable = process.stderr) {
  diagnostics.write(JSON.stringify({ level: "info", event: "stdio_sample_started", server: serverInfo.name }) + "\n");

  const lines = createInterface({ input, crlfDelay: Infinity });
  lines.on("line", (line) => {
    try {
      const message = parseStdioJsonRpcFrame(line);
      if (!isJsonRpcRequest(message)) {
        output.write(serializeStdioJsonRpcFrame(createJsonRpcError(null, -32600, "Invalid Request")));
        return;
      }

      const response = handleStdioMcpRequest(message);
      if (response) {
        output.write(serializeStdioJsonRpcFrame(response));
      }
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : "Invalid Request";
      output.write(serializeStdioJsonRpcFrame(createJsonRpcError(null, -32600, message)));
    }
  });

  return lines;
}

function callTool(request: McpJsonRpcRequest): McpJsonRpcResponse {
  const params = readRecord(request.params);
  const toolName = params.name;
  if (typeof toolName !== "string") {
    return createJsonRpcError(request.id, -32602, "tools/call requires params.name");
  }

  const tool = stdioSampleTools.find((candidate) => candidate.name === toolName);
  if (!tool) {
    return createJsonRpcError(request.id, -32601, `Unknown tool: ${toolName}`);
  }

  try {
    return createJsonRpcResult(request.id, tool.call(readRecord(params.arguments)));
  } catch (caught: unknown) {
    if (caught instanceof ToolInputError) {
      return createJsonRpcError(request.id, -32602, caught.message);
    }
    throw caught;
  }
}

function textJsonResult(value: Record<string, unknown>): Record<string, unknown> {
  return { content: [{ type: "text", text: JSON.stringify(value) }] };
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function isDirectRun() {
  const entrypoint = process.argv[1];
  return entrypoint ? import.meta.url === pathToFileURL(entrypoint).href : false;
}

class ToolInputError extends Error {}

if (process.env.NODE_ENV !== "test" && isDirectRun()) {
  startStdioSampleServer();
}

export type { JsonRpcId };
