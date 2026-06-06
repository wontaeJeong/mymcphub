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
