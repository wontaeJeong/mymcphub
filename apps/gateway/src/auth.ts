import type { IncomingMessage } from "node:http";

import { createMockTokenVerifier } from "@mcp-hub/auth";

import type { GatewayPrincipal } from "./types";

const mockVerifier = createMockTokenVerifier();
const defaultProjectId = "00000000-0000-4000-8000-000000000020";

export async function validateBearerToken(request: IncomingMessage): Promise<GatewayPrincipal | undefined> {
  const authorization = firstHeader(request.headers.authorization);

  if (!authorization?.startsWith("Bearer ")) {
    return undefined;
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (token.length === 0) {
    return undefined;
  }

  try {
    const principal = await mockVerifier.verify(token);

    return {
      userId: principal.subject,
      principalType: principal.principalType,
      teamIds: principal.teamIds,
      clientId: "mcp-client",
      issuer: principal.issuer,
      audience: principal.audience,
      projectId: process.env.MCP_PROJECT_ID ?? defaultProjectId,
      groups: principal.groups,
      roles: principal.roles,
      isPlatformAdmin: principal.isPlatformAdmin
    };
  } catch (caught: unknown) {
    if (caught instanceof Error) {
      return undefined;
    }
    return undefined;
  }
}

function firstHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
