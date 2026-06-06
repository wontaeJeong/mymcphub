import type { GatewayServer, GatewayTool } from "./types";

const projectId = "00000000-0000-4000-8000-000000000020";

export function createDefaultRegistry(): GatewayServer[] {
  return [
    {
      id: "00000000-0000-4000-8000-000000000100",
      slug: "echo",
      environment: "dev",
      transport: "streamable_http",
      upstreamUrl: "http://localhost:5100/mcp",
      enabled: true,
      tools: [
        tool(
          "echo_message",
          "Return the provided message unchanged.",
          "low",
          {
            type: "object",
            properties: { message: { type: "string", description: "Message to echo back." } },
            required: ["message"],
            additionalProperties: false
          }
        ),
        tool("get_server_time", "Return the current server time as an ISO-8601 timestamp.", "low", {
          type: "object",
          properties: {},
          additionalProperties: false
        })
      ],
      grants: [platformGrant(["echo_message", "get_server_time"])]
    },
    {
      id: "00000000-0000-4000-8000-000000000101",
      slug: "internal-docs",
      environment: "dev",
      transport: "streamable_http",
      upstreamUrl: "http://localhost:5101/mcp",
      enabled: true,
      tools: [
        tool(
          "search_docs",
          "Search synthetic internal documentation by keyword and return deterministic snippets.",
          "low",
          {
            type: "object",
            properties: {
              query: { type: "string", description: "Search query." },
              limit: { type: "number", minimum: 1, maximum: 10, description: "Maximum number of results." }
            },
            required: ["query"],
            additionalProperties: false
          }
        ),
        tool("read_doc", "Read one synthetic internal document by id.", "low", {
          type: "object",
          properties: { docId: { type: "string", description: "Document id returned by search_docs." } },
          required: ["docId"],
          additionalProperties: false
        })
      ],
      grants: [platformGrant(["search_docs", "read_doc"])]
    },
    {
      id: "00000000-0000-4000-8000-000000000102",
      slug: "k8s-readonly",
      environment: "dev",
      transport: "streamable_http",
      upstreamUrl: "http://localhost:5102/mcp",
      enabled: true,
      tools: [
        tool("list_namespaces", "List namespace names from the local read-only mock Kubernetes dataset.", "medium", {
          type: "object",
          properties: {},
          additionalProperties: false
        }),
        tool("list_pods", "List pods in one namespace from the local read-only mock Kubernetes dataset.", "medium", {
          type: "object",
          properties: { namespace: { type: "string", description: "Namespace to inspect." } },
          required: ["namespace"],
          additionalProperties: false
        }),
        tool("get_pod", "Read one pod by namespace and name from the local read-only mock Kubernetes dataset.", "medium", {
          type: "object",
          properties: {
            namespace: { type: "string", description: "Pod namespace." },
            podName: { type: "string", description: "Pod name." }
          },
          required: ["namespace", "podName"],
          additionalProperties: false
        })
      ],
      grants: [platformGrant(["list_namespaces", "list_pods", "get_pod"])]
    }
  ];
}

export function findServerBySlug(registry: GatewayServer[], serverSlug: string) {
  return registry.find((server) => server.slug === serverSlug);
}

function tool(name: string, description: string, riskLevel: GatewayTool["riskLevel"], inputSchema: Record<string, unknown>): GatewayTool {
  return { name, description, inputSchema, enabled: true, riskLevel };
}

function platformGrant(allowedTools: string[]) {
  return {
    subjectType: "team" as const,
    subjectId: "platform-team",
    projectId,
    allowedTools
  };
}
