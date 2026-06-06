import { createLogger, withSpan } from "@mcp-hub/logger";
import Fastify from "fastify";
import type { FastifyRequest } from "fastify";

import { registerAuthContext } from "./auth";
import { handleApiError } from "./errors";
import { registerMetrics } from "./metrics";
import { openApiDocument } from "./openapi";
import { registerControlPlaneRoutes } from "./routes";
import { createControlPlaneStore, type ControlPlaneStore } from "./store";

const requestStartTimes = new WeakMap<FastifyRequest, number>();

export type CreateApiServerOptions = {
  store?: ControlPlaneStore;
};

export function createApiServer(options: CreateApiServerOptions = {}) {
  const app = Fastify({ logger: false });
  const store = options.store ?? createControlPlaneStore();
  const logger = createLogger("api");

  app.addHook("onRequest", async (request) => {
    requestStartTimes.set(request, performance.now());
  });
  registerAuthContext(app);
  registerMetrics(app);
  app.setErrorHandler(handleApiError);

  app.addHook("onResponse", async (request, reply) => {
    const startedAt = requestStartTimes.get(request) ?? performance.now();
    const route = request.routeOptions.url ?? "unknown";
    await withSpan("api", "mcp.api.request", { method: request.method, route, status_code: reply.statusCode }, () => {
      logger.info("api.request", {
        traceId: request.traceId,
        method: request.method,
        route,
        status: reply.statusCode,
        duration: Math.round(performance.now() - startedAt)
      });
    });
  });

  app.get("/healthz", async () => ({
    service: "api",
    status: "ok"
  }));

  app.get("/readyz", async () => ({
    dependencies: {
      store: "ready"
    },
    service: "api",
    status: "ready"
  }));

  app.get("/openapi.json", async () => openApiDocument);

  registerControlPlaneRoutes(app, store);

  return app;
}

export async function startApiServer() {
  const app = createApiServer();
  const host = process.env.HOST ?? "0.0.0.0";
  const port = Number(process.env.PORT ?? 4000);

  await app.listen({ host, port });
  return app;
}

if (process.env.NODE_ENV !== "test" && import.meta.url === `file://${process.argv[1]}`) {
  void startApiServer();
}
