export type JsonRpcId = string | number | null;

export type McpToolDescriptor = {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
};

export type McpJsonRpcRequest = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
};
