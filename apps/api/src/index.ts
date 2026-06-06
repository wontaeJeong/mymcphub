import Fastify from "fastify";

import { registerAuthContext } from "./auth";
import { handleApiError } from "./errors";
import { openApiDocument } from "./openapi";
import { registerControlPlaneRoutes } from "./routes";
import { createControlPlaneStore, type ControlPlaneStore } from "./store";

export type CreateApiServerOptions = {
  store?: ControlPlaneStore;
};

export function createApiServer(options: CreateApiServerOptions = {}) {
  const app = Fastify({ logger: false });
  const store = options.store ?? createControlPlaneStore();

  registerAuthContext(app);
  app.setErrorHandler(handleApiError);

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
