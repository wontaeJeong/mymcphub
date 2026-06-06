import { createServer } from "node:http";

import { createGatewayRuntime, type GatewayRuntimeOptions } from "./runtime";

export function createGatewayServer(options: GatewayRuntimeOptions = {}) {
  const runtime = createGatewayRuntime(options);
  const server = createServer((request, response) => {
    void runtime.handle(request, response);
  });

  return { runtime, server };
}

export function startGatewayServer(options: GatewayRuntimeOptions = {}) {
  const { server, runtime } = createGatewayServer(options);
  const port = Number(process.env.PORT ?? 5000);

  server.listen(port);
  return { runtime, server };
}

if (process.env.NODE_ENV !== "test" && import.meta.url === `file://${process.argv[1]}`) {
  startGatewayServer();
}
