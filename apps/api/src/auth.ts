import { randomUUID } from "node:crypto";

import type { FastifyInstance, FastifyRequest } from "fastify";

import type { AuthContext } from "./types";

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext;
    traceId: string;
  }
}

const defaultMockAuth: AuthContext = {
  userId: "00000000-0000-4000-8000-000000000001",
  email: "admin@example.com",
  displayName: "Admin User",
  teamIds: ["00000000-0000-4000-8000-000000000010"],
  roles: ["admin"],
  clientId: "local-dev-client",
  issuer: "mock-auth",
  audience: "mcp-hub"
};

export function registerAuthContext(app: FastifyInstance) {
  app.addHook("preHandler", async (request) => {
    request.traceId = firstHeader(request, "x-trace-id") ?? randomUUID();
    request.auth = buildAuthContext(request);
  });
}

function buildAuthContext(request: FastifyRequest): AuthContext {
  if (process.env.MCP_AUTH_MODE === "oidc") {
    return {
      userId: firstHeader(request, "x-user-id") ?? defaultMockAuth.userId,
      email: firstHeader(request, "x-user-email") ?? defaultMockAuth.email,
      displayName: firstHeader(request, "x-user-display-name") ?? defaultMockAuth.displayName,
      teamIds: splitHeader(firstHeader(request, "x-team-ids")) ?? defaultMockAuth.teamIds,
      roles: splitHeader(firstHeader(request, "x-roles")) ?? defaultMockAuth.roles,
      clientId: firstHeader(request, "x-client-id") ?? defaultMockAuth.clientId,
      issuer: process.env.OIDC_ISSUER_URL ?? defaultMockAuth.issuer,
      audience: process.env.OIDC_AUDIENCE ?? defaultMockAuth.audience
    };
  }

  return defaultMockAuth;
}

function firstHeader(request: FastifyRequest, name: string) {
  const value = request.headers[name];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function splitHeader(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}
