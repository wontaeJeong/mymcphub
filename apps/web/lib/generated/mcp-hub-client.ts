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
