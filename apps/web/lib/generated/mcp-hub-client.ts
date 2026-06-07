declare const process: { env: Record<string, string | undefined> };

export class GeneratedApiClientError extends Error {
  readonly status?: number;
  readonly details?: unknown;

  constructor(message: string, status?: number, details?: unknown) {
    super(message);
    this.name = "GeneratedApiClientError";
    this.status = status;
    this.details = details;
  }
}

export function getGeneratedApiBaseUrl() {
  return process.env.MCP_API_URL ?? process.env.NEXT_PUBLIC_MCP_API_URL ?? "http://localhost:4000";
}

export const MCP_HUB_OPENAPI_PATHS = [
  "/api/admin/emergency-deny",
  "/api/admin/emergency-deny/disable",
  "/api/admin/kill-switch",
  "/api/admin/revoke-server-grants/{serverId}",
  "/api/approvals",
  "/api/approvals/{approvalId}/approve",
  "/api/approvals/{approvalId}/reject",
  "/api/audit-events",
  "/api/audit-events/export",
  "/api/audit-events/export/jobs",
  "/api/audit-events/gateway",
  "/api/client-config/generate",
  "/api/grants",
  "/api/grants/{grantId}",
  "/api/grants/{grantId}/approve",
  "/api/grants/{grantId}/revoke",
  "/api/me",
  "/api/policy/simulate",
  "/api/policy/test-call",
  "/api/policy/validate",
  "/api/secret-bindings",
  "/api/secret-bindings/{secretBindingId}",
  "/api/server-health",
  "/api/servers",
  "/api/servers/{serverId}",
  "/api/servers/{serverId}/disable",
  "/api/servers/{serverId}/enable",
  "/api/servers/{serverId}/publish",
  "/api/servers/{serverId}/quarantine",
  "/api/servers/{serverId}/rollout",
  "/api/servers/{serverId}/schema-diff",
  "/api/servers/{serverId}/schema-diff/history",
  "/api/servers/{serverId}/schema-snapshots",
  "/api/servers/{serverId}/tools",
  "/api/servers/{serverId}/tools/{toolId}",
  "/api/servers/{serverId}/tools/{toolId}/disable",
  "/api/servers/{serverId}/tools/{toolId}/enable",
  "/api/servers/{serverId}/tools/{toolId}/schema",
  "/api/servers/{serverId}/unpublish",
  "/api/servers/{serverId}/versions",
  "/api/servers/{serverId}/versions/{versionId}/activate",
  "/api/servers/{serverId}/versions/{versionId}/rollback",
  "/api/tenancy/policy-input",
  "/api/tenancy/projects",
  "/api/tenancy/projects/{projectId}/members",
  "/api/tenancy/projects/{projectId}/members/{subjectType}/{subjectId}",
  "/api/tenancy/teams",
  "/api/tenancy/teams/{teamId}/members",
  "/api/tenancy/teams/{teamId}/members/{userId}",
  "/api/tenancy/users",
  "/api/tool-call-events",
  "/healthz",
  "/metrics",
  "/readyz"
] as const;

export type McpHubOpenApiPath = (typeof MCP_HUB_OPENAPI_PATHS)[number];

export function isMcpHubOpenApiPath(path: string): path is McpHubOpenApiPath {
  return (MCP_HUB_OPENAPI_PATHS as readonly string[]).includes(path);
}

export function formatGeneratedApiError(error: unknown) {
  if (error instanceof GeneratedApiClientError) {
    return error.status ? `${error.message} (${error.status})` : error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "The Control Plane API is unavailable.";
}

export async function generatedApiRequest<Result>(path: string, init: RequestInit = {}): Promise<Result> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(new URL(path, getGeneratedApiBaseUrl()), {
      ...init,
      headers,
      cache: "no-store"
    });
  } catch (error) {
    throw new GeneratedApiClientError("Unable to reach the Control Plane API.", undefined, error);
  }

  if (!response.ok) {
    throw new GeneratedApiClientError(await readGeneratedErrorMessage(response), response.status);
  }

  if (response.status === 204) {
    return undefined as Result;
  }

  return (await response.json()) as Result;
}

async function readGeneratedErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as unknown;
    if (isGeneratedErrorResponse(body)) {
      return body.error.message;
    }
  } catch {
    return response.statusText || "Control Plane API request failed.";
  }

  return response.statusText || "Control Plane API request failed.";
}

function isGeneratedErrorResponse(value: unknown): value is { error: { message: string } } {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const error = candidate.error;
  if (!error || typeof error !== "object") {
    return false;
  }

  const errorRecord = error as Record<string, unknown>;
  return typeof errorRecord.message === "string";
}
