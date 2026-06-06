import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

export type GatewayRoute = {
  id: string;
  displayName: string;
  upstreamUrl: string;
};

export function createGatewayServer(routes: GatewayRoute[] = []) {
  return createServer((_request: IncomingMessage, response: ServerResponse) => {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ routes, service: "gateway", status: "ok" }));
  });
}

export function startGatewayServer(routes: GatewayRoute[] = []) {
  const server = createGatewayServer(routes);
  const port = Number(process.env.PORT ?? 5000);

  server.listen(port);
  return server;
}

if (process.env.NODE_ENV !== "test" && import.meta.url === `file://${process.argv[1]}`) {
  startGatewayServer();
}
