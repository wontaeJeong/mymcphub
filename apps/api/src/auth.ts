import { randomUUID } from "node:crypto";

import { createMockAdminPrincipal, type AuthenticatedPrincipal } from "@mcp-hub/auth";
import type { FastifyInstance, FastifyRequest } from "fastify";

import type { AuthContext } from "./types";

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext;
    traceId: string;
  }
}

const defaultMockPrincipal = createMockAdminPrincipal({
  subject: "00000000-0000-4000-8000-000000000001",
  teamIds: ["00000000-0000-4000-8000-000000000010"],
  teams: ["00000000-0000-4000-8000-000000000010"],
  groups: ["platform"],
  roles: ["admin"],
  clientId: "local-dev-client",
  issuer: "mock-auth",
  audience: "mcp-hub"
});

const defaultMockAuth = authContextFromPrincipal(defaultMockPrincipal);

export function registerAuthContext(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    request.traceId = firstHeader(request, "x-trace-id") ?? randomUUID();
    reply.header("x-trace-id", request.traceId);
    request.auth = buildAuthContext(request);
  });
}

function buildAuthContext(request: FastifyRequest): AuthContext {
  if (process.env.MCP_AUTH_MODE === "oidc") {
    const teamIds = splitHeader(firstHeader(request, "x-team-ids")) ?? defaultMockAuth.teamIds;
    const groups = splitHeader(firstHeader(request, "x-groups")) ?? defaultMockAuth.groups;
    const roles = splitHeader(firstHeader(request, "x-roles")) ?? defaultMockAuth.roles;
    const principalType = readPrincipalType(firstHeader(request, "x-principal-type")) ?? defaultMockAuth.principalType;
    const issuer = process.env.OIDC_ISSUER_URL ?? defaultMockAuth.issuer;

    return {
      userId: firstHeader(request, "x-user-id") ?? defaultMockAuth.userId,
      principalType,
      email: firstHeader(request, "x-user-email") ?? defaultMockAuth.email,
      displayName: firstHeader(request, "x-user-display-name") ?? defaultMockAuth.displayName,
      teamIds,
      teams: splitHeader(firstHeader(request, "x-teams")) ?? teamIds,
      groups,
      roles,
      clientId: firstHeader(request, "x-client-id") ?? defaultMockAuth.clientId,
      issuer,
      audience: process.env.OIDC_AUDIENCE ?? defaultMockAuth.audience,
      isAdmin: roles.includes("admin"),
      isPlatformAdmin: roles.includes("platform_admin") || roles.includes("admin") || groups.includes("platform-admins"),
      authSource: "oidc",
      tokenIssuer: issuer
    };
  }

  return defaultMockAuth;
}

function authContextFromPrincipal(principal: AuthenticatedPrincipal): AuthContext {
  return {
    userId: principal.subject,
    principalType: principal.principalType,
    email: principal.email ?? "",
    displayName: principal.displayName ?? principal.subject,
    teamIds: principal.teamIds,
    teams: principal.teams,
    groups: principal.groups,
    roles: principal.roles,
    clientId: principal.clientId,
    issuer: principal.issuer,
    audience: principal.audience,
    isAdmin: principal.isAdmin,
    isPlatformAdmin: principal.isPlatformAdmin,
    authSource: principal.authSource,
    tokenIssuer: principal.tokenIssuer
  };
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

function readPrincipalType(value: string | undefined): AuthContext["principalType"] | undefined {
  if (value === "user" || value === "team" || value === "service_account") {
    return value;
  }

  return undefined;
}
