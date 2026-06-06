import Fastify from "fastify";

export function createApiServer() {
  const app = Fastify({ logger: false });

  app.get("/healthz", async () => ({
    service: "api",
    status: "ok"
  }));

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
