import type { IncomingMessage } from "node:http";

import type { GatewayPrincipal } from "./types";

export function validateBearerToken(request: IncomingMessage): GatewayPrincipal | undefined {
  const authorization = firstHeader(request.headers.authorization);

  if (!authorization?.startsWith("Bearer ")) {
    return undefined;
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (token.length === 0 || token === "invalid") {
    return undefined;
  }

  return {
    userId: token === "dev-readonly-token" ? "readonly-user" : "admin-user",
    teamIds: token === "dev-readonly-token" ? ["readonly-team"] : ["platform-team"],
    clientId: "mcp-client",
    issuer: process.env.OIDC_ISSUER_URL ?? "mock-gateway-issuer",
    audience: process.env.OIDC_AUDIENCE ?? "mcp-hub"
  };
}

function firstHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
