import type { FastifyInstance } from "fastify";

import { generateClientConfig } from "./client-config";
import { authorizationError, validationError } from "./errors";
import type { ControlPlaneStore } from "./store";
import type { AuthContext } from "./types";

type ServerParams = { serverId: string };
type ToolParams = ServerParams & { toolId: string };
type GrantParams = { grantId: string };
type ApprovalParams = { approvalId: string };

export function registerControlPlaneRoutes(app: FastifyInstance, store: ControlPlaneStore) {
  app.get("/api/me", async (request) => ({ auth: request.auth }));

  app.get("/api/servers", async () => store.listServers());
  app.post("/api/servers", async (request, reply) => {
    requirePlatformAdmin(request.auth);
    const server = store.createServer(request.body, request.auth);
    return reply.code(201).send(server);
  });
  app.get<{ Params: ServerParams }>("/api/servers/:serverId", async (request) => store.getServer(request.params.serverId));
  app.patch<{ Params: ServerParams }>("/api/servers/:serverId", async (request) => {
    requirePlatformAdmin(request.auth);
    return store.patchServer(request.params.serverId, request.body, request.auth);
  });
  app.post<{ Params: ServerParams }>("/api/servers/:serverId/disable", async (request) => {
    requirePlatformAdmin(request.auth);
    return store.setServerEnabled(request.params.serverId, false, request.auth);
  });
  app.post<{ Params: ServerParams }>("/api/servers/:serverId/enable", async (request) => {
    requirePlatformAdmin(request.auth);
    return store.setServerEnabled(request.params.serverId, true, request.auth);
  });

  app.get<{ Params: ServerParams }>("/api/servers/:serverId/tools", async (request) =>
    store.listTools(request.params.serverId)
  );
  app.patch<{ Params: ToolParams }>("/api/servers/:serverId/tools/:toolId", async (request) => {
    requirePlatformAdmin(request.auth);
    return store.patchTool(request.params.serverId, request.params.toolId, request.body, request.auth);
  });
  app.post<{ Params: ToolParams }>("/api/servers/:serverId/tools/:toolId/disable", async (request) => {
    requirePlatformAdmin(request.auth);
    return store.setToolEnabled(request.params.serverId, request.params.toolId, false, request.auth);
  });
  app.post<{ Params: ToolParams }>("/api/servers/:serverId/tools/:toolId/enable", async (request) => {
    requirePlatformAdmin(request.auth);
    return store.setToolEnabled(request.params.serverId, request.params.toolId, true, request.auth);
  });

  app.get("/api/grants", async () => store.listGrants());
  app.post("/api/grants", async (request, reply) => {
    requirePlatformAdmin(request.auth);
    const grant = store.createGrant(request.body, request.auth);
    return reply.code(201).send(grant);
  });
  app.patch<{ Params: GrantParams }>("/api/grants/:grantId", async (request) => {
    requirePlatformAdmin(request.auth);
    return store.patchGrant(request.params.grantId, request.body, request.auth);
  });
  app.post<{ Params: GrantParams }>("/api/grants/:grantId/revoke", async (request) => {
    requirePlatformAdmin(request.auth);
    return store.revokeGrant(request.params.grantId, request.auth);
  });

  app.get("/api/approvals", async () => store.listApprovals());
  app.post("/api/approvals", async (request, reply) => {
    const approval = store.createApproval(request.body, request.auth);
    return reply.code(201).send(approval);
  });
  app.post<{ Params: ApprovalParams }>("/api/approvals/:approvalId/approve", async (request) => {
    requirePlatformAdmin(request.auth);
    return store.decideApproval(request.params.approvalId, "approved", request.auth, request.body);
  });
  app.post<{ Params: ApprovalParams }>("/api/approvals/:approvalId/reject", async (request) => {
    requirePlatformAdmin(request.auth);
    return store.decideApproval(request.params.approvalId, "rejected", request.auth, request.body);
  });

  app.get("/api/audit-events", async (request) => {
    const query = queryRecord(request.query);
    return store.listAuditEvents(readLimit(query.limit), optionalQueryString(query.cursor));
  });
  app.get("/api/tool-call-events", async () => store.listToolCallEvents());
  app.get("/api/server-health", async () => store.listServerHealth());

  app.post("/api/client-config/generate", async (request) => {
    const body = bodyRecord(request.body);
    const serverId = requiredBodyString(body.serverId, "serverId");
    const client = requiredBodyString(body.client, "client");
    return generateClientConfig(client, store.getServer(serverId));
  });

  app.post("/api/admin/emergency-deny", async (request) => {
    requirePlatformAdmin(request.auth);
    const body = bodyRecord(request.body);
    requiredBodyString(body.reason, "reason");
    return store.enableEmergencyDeny(body, request.auth);
  });
  app.post<{ Params: ServerParams }>("/api/admin/revoke-server-grants/:serverId", async (request) => {
    requirePlatformAdmin(request.auth);
    return store.revokeServerGrants(request.params.serverId, request.auth);
  });
}

function requirePlatformAdmin(auth: AuthContext) {
  if (!auth.isPlatformAdmin) {
    throw authorizationError("Platform admin role is required for this action.");
  }
}

function bodyRecord(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {};
  }

  return body as Record<string, unknown>;
}

function queryRecord(query: unknown): Record<string, unknown> {
  return bodyRecord(query);
}

function requiredBodyString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.length === 0) {
    throw validationError(`${fieldName} is required`);
  }

  return value;
}

function optionalQueryString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readLimit(value: unknown) {
  if (typeof value !== "string") {
    return 50;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw validationError("limit must be an integer between 1 and 100");
  }

  return parsed;
}
