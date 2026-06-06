import type { FastifyInstance } from "fastify";
import { Counter, Registry } from "prom-client";

export function registerMetrics(app: FastifyInstance) {
  const registry = new Registry();
  const requestCounter = new Counter({
    name: "mcp_api_requests_total",
    help: "Total API HTTP requests.",
    labelNames: ["method", "route", "status_family"] as const,
    registers: [registry]
  });

  app.addHook("onResponse", async (request, reply) => {
    requestCounter.inc({
      method: request.method,
      route: request.routeOptions.url ?? "unknown",
      status_family: `${Math.floor(reply.statusCode / 100)}xx`
    });
  });

  app.get("/metrics", async (_request, reply) =>
    reply.header("content-type", registry.contentType).send(await registry.metrics())
  );
}
