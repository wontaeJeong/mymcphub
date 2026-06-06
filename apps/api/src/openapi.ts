export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "MCP Hub Control Plane API",
    version: "0.1.0"
  },
  paths: {
    "/healthz": { get: { summary: "Health check", responses: { "200": { description: "Healthy" } } } },
    "/readyz": { get: { summary: "Readiness check", responses: { "200": { description: "Ready" } } } },
    "/api/me": { get: { summary: "Current auth context", responses: { "200": { description: "Auth context" } } } },
    "/api/servers": {
      get: { summary: "List MCP servers", responses: { "200": { description: "Server list" } } },
      post: { summary: "Create MCP server", responses: { "201": { description: "Created server" } } }
    },
    "/api/servers/{serverId}": {
      get: { summary: "Get MCP server", responses: { "200": { description: "Server" }, "404": { description: "Not found" } } },
      patch: { summary: "Update MCP server", responses: { "200": { description: "Updated server" } } }
    },
    "/api/servers/{serverId}/disable": { post: { summary: "Disable MCP server", responses: { "200": { description: "Disabled server" } } } },
    "/api/servers/{serverId}/enable": { post: { summary: "Enable MCP server", responses: { "200": { description: "Enabled server" } } } },
    "/api/servers/{serverId}/tools": { get: { summary: "List server tools", responses: { "200": { description: "Tool list" } } } },
    "/api/servers/{serverId}/tools/{toolId}": { patch: { summary: "Update tool", responses: { "200": { description: "Updated tool" } } } },
    "/api/servers/{serverId}/tools/{toolId}/disable": { post: { summary: "Disable tool", responses: { "200": { description: "Disabled tool" } } } },
    "/api/servers/{serverId}/tools/{toolId}/enable": { post: { summary: "Enable tool", responses: { "200": { description: "Enabled tool" } } } },
    "/api/grants": {
      get: { summary: "List grants", responses: { "200": { description: "Grant list" } } },
      post: { summary: "Create grant", responses: { "201": { description: "Created grant" } } }
    },
    "/api/grants/{grantId}": { patch: { summary: "Update grant", responses: { "200": { description: "Updated grant" } } } },
    "/api/grants/{grantId}/revoke": { post: { summary: "Revoke grant", responses: { "200": { description: "Revoked grant" } } } },
    "/api/approvals": {
      get: { summary: "List approvals", responses: { "200": { description: "Approval list" } } },
      post: { summary: "Create approval", responses: { "201": { description: "Created approval" } } }
    },
    "/api/approvals/{approvalId}/approve": { post: { summary: "Approve request", responses: { "200": { description: "Approved request" } } } },
    "/api/approvals/{approvalId}/reject": { post: { summary: "Reject request", responses: { "200": { description: "Rejected request" } } } },
    "/api/audit-events": { get: { summary: "Search audit events", responses: { "200": { description: "Paginated audit events" } } } },
    "/api/tool-call-events": { get: { summary: "List tool call events", responses: { "200": { description: "Tool call events" } } } },
    "/api/server-health": { get: { summary: "List server health checks", responses: { "200": { description: "Server health checks" } } } },
    "/api/client-config/generate": { post: { summary: "Generate client config", responses: { "200": { description: "Client config snippet" } } } },
    "/api/admin/emergency-deny": { post: { summary: "Enable emergency deny", responses: { "200": { description: "Emergency deny state" } } } },
    "/api/admin/revoke-server-grants/{serverId}": { post: { summary: "Revoke server grants", responses: { "200": { description: "Revocation summary" } } } }
  },
  components: {
    schemas: {
      ErrorResponse: {
        type: "object",
        required: ["error", "traceId"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message", "details"],
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              details: { type: "object" }
            }
          },
          traceId: { type: "string" }
        }
      }
    }
  }
} as const;
