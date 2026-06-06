import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";

import {
  createJsonRpcError,
  isJsonRpcResponse,
  parseStdioJsonRpcFrame,
  serializeStdioJsonRpcFrame,
  type JsonRpcId,
  type McpJsonRpcMessage,
  type McpJsonRpcRequest,
  type McpJsonRpcResponse
} from "@mcp-hub/mcp-protocol";

export type StdioAdapterConfig = {
  port: number;
  command: string;
  args: string[];
  workdir?: string;
  startupTimeoutMs: number;
  requestTimeoutMs: number;
  maxBodyBytes: number;
  maxQueueDepth: number;
};

type RuntimeStatus = "starting" | "healthy" | "unhealthy";

type StderrEntry = {
  timestamp: string;
  line: string;
};

type QueuedRequest = {
  request: McpJsonRpcRequest;
  complete: (response: McpJsonRpcResponse) => void;
  fail: (reason: string) => void;
  timeout?: NodeJS.Timeout;
};

const startupPingId = "stdio-adapter-startup";

export function readConfigFromEnv(env: NodeJS.ProcessEnv = process.env): StdioAdapterConfig {
  const command = env.STDIO_MCP_COMMAND ?? "node";
  return {
    port: readPositiveInteger(env.PORT, 5103),
    command,
    args: parseArgs(env.STDIO_MCP_ARGS ?? ""),
    workdir: env.STDIO_WORKDIR,
    startupTimeoutMs: readPositiveInteger(env.STDIO_STARTUP_TIMEOUT_MS, 10_000),
    requestTimeoutMs: readPositiveInteger(env.STDIO_REQUEST_TIMEOUT_MS, 30_000),
    maxBodyBytes: readPositiveInteger(env.STDIO_MAX_BODY_BYTES, 1_048_576),
    maxQueueDepth: readPositiveInteger(env.STDIO_MAX_QUEUE_DEPTH, 16)
  };
}

export function createStdioAdapterServer(config: StdioAdapterConfig = readConfigFromEnv()) {
  const runtime = new StdioAdapterRuntime(config);
  runtime.start();
  const server = createServer((request, response) => {
    void handleHttpRequest(request, response, runtime, config);
  });

  return { runtime, server };
}

export function startStdioAdapterServer(config: StdioAdapterConfig = readConfigFromEnv()) {
  const adapter = createStdioAdapterServer(config);
  adapter.server.listen(config.port);
  return adapter;
}

export class StdioAdapterRuntime {
  private child: ChildProcessWithoutNullStreams | undefined;
  private active: QueuedRequest | undefined;
  private stdoutBuffer = "";
  private stderrBuffer = "";
  private queue: QueuedRequest[] = [];
  private status: RuntimeStatus = "starting";
  private unhealthyReason: string | undefined;
  private stderrEntries: StderrEntry[] = [];
  private startupTimer: NodeJS.Timeout | undefined;
  private started = false;

  constructor(private readonly config: StdioAdapterConfig) {}

  start() {
    if (this.started) {
      return;
    }
    this.started = true;
    this.child = spawn(this.config.command, this.config.args, {
      cwd: this.config.workdir,
      shell: false,
      stdio: "pipe"
    });

    this.child.stdout.setEncoding("utf8");
    this.child.stderr.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => this.handleStdout(chunk));
    this.child.stderr.on("data", (chunk: string) => this.handleStderr(chunk));
    this.child.on("error", (error) => this.markUnhealthy(`process error: ${error.message}`, true));
    this.child.on("exit", (code, signal) => {
      if (this.status !== "unhealthy") {
        this.markUnhealthy(`process exited: code=${code ?? "null"} signal=${signal ?? "null"}`, false);
      }
    });

    this.startupTimer = setTimeout(() => {
      this.markUnhealthy("startup timeout", true);
    }, this.config.startupTimeoutMs);

    this.sendStartupPing();
  }

  stop() {
    if (this.startupTimer) {
      clearTimeout(this.startupTimer);
      this.startupTimer = undefined;
    }
    this.rejectActiveAndQueued("adapter stopped");
    if (this.child && !this.child.killed) {
      this.child.kill();
    }
  }

  metadata() {
    return {
      adapter: "stdio-adapter",
      transport: "stdio_adapter",
      policy: "serialized_fifo",
      command: this.config.command,
      args: this.config.args,
      workdir: this.config.workdir,
      requestTimeoutMs: this.config.requestTimeoutMs,
      maxBodyBytes: this.config.maxBodyBytes,
      maxQueueDepth: this.config.maxQueueDepth,
      status: this.status,
      queueDepth: this.queue.length
    };
  }

  health() {
    return {
      status: this.status,
      unhealthyReason: this.unhealthyReason,
      childPid: this.child?.pid,
      queueDepth: this.queue.length,
      active: this.active ? true : false,
      stderr: this.stderrEntries
    };
  }

  async send(request: McpJsonRpcRequest): Promise<McpJsonRpcResponse> {
    if (this.status !== "healthy") {
      return createJsonRpcError(request.id, -32010, this.unhealthyReason ?? "Adapter is not healthy");
    }
    if (this.queue.length >= this.config.maxQueueDepth) {
      return createJsonRpcError(request.id, -32011, "Adapter request queue is full");
    }

    return new Promise((resolve) => {
      this.queue.push({
        request,
        complete: resolve,
        fail: (reason) => resolve(createJsonRpcError(request.id, -32010, reason))
      });
      this.drainQueue();
    });
  }

  async acceptNotification(request: McpJsonRpcRequest): Promise<boolean> {
    if (this.status !== "healthy" || this.queue.length >= this.config.maxQueueDepth) {
      return false;
    }

    return new Promise((resolve) => {
      this.queue.push({
        request,
        complete: () => resolve(true),
        fail: () => resolve(false)
      });
      this.drainQueue();
    });
  }

  private sendStartupPing() {
    const startupRequest: QueuedRequest = {
      request: { jsonrpc: "2.0", id: startupPingId, method: "ping" },
      complete: () => {
        if (this.startupTimer) {
          clearTimeout(this.startupTimer);
          this.startupTimer = undefined;
        }
        if (this.status === "starting") {
          this.status = "healthy";
        }
      },
      fail: (reason) => this.markUnhealthy(reason, true)
    };
    this.active = startupRequest;
    this.writeFrame(startupRequest.request);
  }

  private drainQueue() {
    if (this.active || this.status !== "healthy") {
      return;
    }

    const next = this.queue.shift();
    if (!next) {
      return;
    }

    this.active = next;
    if (next.request.id === undefined) {
      this.writeFrame(next.request);
      this.active = undefined;
      next.complete({ jsonrpc: "2.0", id: null, result: { accepted: true } });
      this.drainQueue();
      return;
    }

    next.timeout = setTimeout(() => {
      this.resolveTimedOutRequest(next);
      next.complete(createJsonRpcError(next.request.id, -32012, "Stdio request timed out"));
    }, this.config.requestTimeoutMs);
    this.writeFrame(next.request);
  }

  private writeFrame(message: McpJsonRpcRequest) {
    if (!this.child || this.child.killed || !this.child.stdin.writable) {
      this.markUnhealthy("process stdin is unavailable", true);
      return;
    }
    this.child.stdin.write(serializeStdioJsonRpcFrame(message));
  }

  private handleStdout(chunk: string) {
    this.stdoutBuffer += chunk;
    let newlineIndex = this.stdoutBuffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const rawLine = this.stdoutBuffer.slice(0, newlineIndex);
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1);
      this.handleStdoutLine(rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine);
      newlineIndex = this.stdoutBuffer.indexOf("\n");
    }
  }

  private handleStdoutLine(line: string) {
    let message: McpJsonRpcMessage;
    try {
      message = parseStdioJsonRpcFrame(line);
    } catch (caught: unknown) {
      const reason = caught instanceof Error ? caught.message : "protocol violation";
      this.markUnhealthy(`protocol violation: ${reason}`, true);
      return;
    }

    if (!isJsonRpcResponse(message)) {
      this.markUnhealthy("protocol violation: stdout message was not a response", true);
      return;
    }

    const active = this.active;
    if (!active || !sameJsonRpcId(active.request.id, message.id)) {
      this.markUnhealthy("protocol violation: unexpected response id", true);
      return;
    }

    if (active.timeout) {
      clearTimeout(active.timeout);
    }
    this.active = undefined;
    active.complete(message);
    this.drainQueue();
  }

  private handleStderr(chunk: string) {
    this.stderrBuffer += chunk;
    let newlineIndex = this.stderrBuffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const rawLine = this.stderrBuffer.slice(0, newlineIndex);
      this.stderrBuffer = this.stderrBuffer.slice(newlineIndex + 1);
      const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
      if (line.length > 0) {
        this.stderrEntries.unshift({ timestamp: new Date().toISOString(), line });
        this.stderrEntries = this.stderrEntries.slice(0, 20);
      }
      newlineIndex = this.stderrBuffer.indexOf("\n");
    }
  }

  private markUnhealthy(reason: string, terminate: boolean) {
    if (this.status === "unhealthy" && this.unhealthyReason === reason) {
      return;
    }
    this.status = "unhealthy";
    this.unhealthyReason = reason;
    if (this.startupTimer) {
      clearTimeout(this.startupTimer);
      this.startupTimer = undefined;
    }
    this.rejectActiveAndQueued(reason);
    if (terminate && this.child && !this.child.killed) {
      this.child.kill();
    }
  }

  private resolveTimedOutRequest(request: QueuedRequest) {
    this.status = "unhealthy";
    this.unhealthyReason = "request timeout";
    if (this.active === request) {
      this.active = undefined;
    }
    if (request.timeout) {
      clearTimeout(request.timeout);
    }
    const queued = this.queue.splice(0);
    for (const item of queued) {
      item.fail("request timeout");
    }
    if (this.child && !this.child.killed) {
      this.child.kill();
    }
  }

  private rejectActiveAndQueued(reason: string) {
    const active = this.active;
    this.active = undefined;
    if (active) {
      if (active.timeout) {
        clearTimeout(active.timeout);
      }
      active.fail(reason);
    }
    const queued = this.queue.splice(0);
    for (const item of queued) {
      item.fail(reason);
    }
  }
}

async function handleHttpRequest(request: IncomingMessage, response: ServerResponse, runtime: StdioAdapterRuntime, config: StdioAdapterConfig) {
  const url = new URL(request.url ?? "/", "http://localhost");

  if (request.method === "GET" && url.pathname === "/healthz") {
    const health = runtime.health();
    sendJson(response, health.status === "healthy" ? 200 : 503, health);
    return;
  }

  if (request.method === "GET" && url.pathname === "/mcp") {
    sendJson(response, 200, runtime.metadata());
    return;
  }

  if (request.method === "POST" && url.pathname === "/mcp") {
    let parsed: McpJsonRpcRequest;
    try {
      parsed = parseJsonRpcRequest(await readJsonBody(request, config.maxBodyBytes));
    } catch (caught: unknown) {
      if (caught instanceof BodyTooLargeError) {
        sendJson(response, 413, { error: "request_body_too_large", maxBodyBytes: config.maxBodyBytes });
        return;
      }
      if (caught instanceof JsonRpcRequestError) {
        sendJson(response, 400, createJsonRpcError(caught.id, caught.code, caught.message));
        return;
      }
      throw caught;
    }

    if (parsed.id === undefined) {
      const accepted = await runtime.acceptNotification(parsed);
      if (!accepted) {
        sendJson(response, 503, createJsonRpcError(null, -32011, "Adapter request queue is full or unhealthy"));
        return;
      }
      sendJson(response, 202, { accepted: true });
      return;
    }

    const result = await runtime.send(parsed);
    const statusCode = httpStatusForJsonRpcResult(result);
    sendJson(response, statusCode, result);
    return;
  }

  sendJson(response, url.pathname === "/mcp" || url.pathname === "/healthz" ? 405 : 404, { error: "not_found" });
}

function httpStatusForJsonRpcResult(result: McpJsonRpcResponse) {
  if (result.error?.code === -32011) {
    return 503;
  }
  if (result.error?.code === -32012) {
    return 504;
  }
  if (result.error?.code === -32010) {
    return 503;
  }
  return 200;
}

async function readJsonBody(request: IncomingMessage, maxBodyBytes: number): Promise<unknown> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    totalBytes += buffer.byteLength;
    if (totalBytes > maxBodyBytes) {
      throw new BodyTooLargeError();
    }
    chunks.push(buffer);
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

  return { jsonrpc: "2.0", id, method: record.method, params };
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

function sameJsonRpcId(left: JsonRpcId | undefined, right: JsonRpcId) {
  return (left ?? null) === right;
}

function sendJson(response: ServerResponse, statusCode: number, payload: Record<string, unknown> | McpJsonRpcResponse) {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(payload));
}

function readPositiveInteger(value: string | undefined, fallback: number) {
  if (value === undefined || value.length === 0) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseArgs(value: string) {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return [];
  }
  if (trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
      return parsed;
    }
    throw new Error("STDIO_MCP_ARGS JSON value must be an array of strings.");
  }
  return trimmed.split(/\s+/);
}

function isDirectRun() {
  const entrypoint = process.argv[1];
  return entrypoint ? import.meta.url === pathToFileURL(entrypoint).href : false;
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

class BodyTooLargeError extends Error {}

if (process.env.NODE_ENV !== "test" && isDirectRun()) {
  startStdioAdapterServer();
}

export type { Server };
