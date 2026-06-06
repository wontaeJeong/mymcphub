import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";

type ZodIssueLike = {
  message: string;
  path: readonly (string | number)[];
};

type ZodErrorLike = Error & {
  issues: ZodIssueLike[];
};

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 500,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
  }
}

export function notFound(code: string, message: string) {
  return new ApiError(code, message, 404);
}

export function validationError(message: string, details: Record<string, unknown> = {}) {
  return new ApiError("VALIDATION_ERROR", message, 400, details);
}

export function toErrorResponse(error: ApiError, traceId: string) {
  return {
    error: {
      code: error.code,
      message: error.message,
      details: error.details
    },
    traceId
  };
}

export function handleApiError(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
) {
  const traceId = request.traceId ?? "unknown-trace";

  if (error instanceof ApiError) {
    return reply.code(error.statusCode).send(toErrorResponse(error, traceId));
  }

  if (isZodError(error)) {
    const apiError = validationError("Request validation failed", { issues: error.issues });
    return reply.code(apiError.statusCode).send(toErrorResponse(apiError, traceId));
  }

  const apiError = new ApiError("INTERNAL_SERVER_ERROR", error.message, 500);
  return reply.code(500).send(toErrorResponse(apiError, traceId));
}

function isZodError(error: unknown): error is ZodErrorLike {
  if (!(error instanceof Error) || error.name !== "ZodError") {
    return false;
  }

  const candidate = error as { issues?: unknown };
  return Array.isArray(candidate.issues);
}
