# MCP Hub Web

`apps/web` is the Next.js App Router operations console for prompt 05. It renders the MCP Hub dashboard, server catalog, server detail, tool explorer, access requests and grants, approval queue, audit log, health operations, client config generator, and admin emergency controls.

## Run Locally

From the repository root:

```sh
pnpm install
go run ./apps/api/cmd/api
pnpm --filter @mcp-hub/web dev
```

The web app defaults to the local Control Plane API at `http://localhost:4000`. If the API is offline or an endpoint returns an error, the UI renders error or empty states instead of mock data.

## Environment

Set either variable to point the web app at another Control Plane API base URL:

```sh
MCP_API_URL=http://localhost:4000
NEXT_PUBLIC_MCP_API_URL=http://localhost:4000
```

`MCP_API_URL` is preferred for server-side requests. `NEXT_PUBLIC_MCP_API_URL` is also supported for deployments that already expose a public API base URL.

## Validation

Run the repository validation commands from the root:

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

The Web API boundary is generated at `apps/web/lib/generated/mcp-hub-client.ts` from the OpenAPI source under `schemas/openapi/`.

The web workspace also includes a component test for the dashboard summary:

```sh
pnpm --filter @mcp-hub/web test
```
