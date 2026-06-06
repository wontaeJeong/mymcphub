# MCP Hub

MCP Hub is an internal platform skeleton for managing MCP server catalog entries, a control plane API, a gateway data plane, worker jobs, and first-party MCP servers from one TypeScript monorepo.

## Workspace Structure

```txt
apps/
  web/          Next.js App Router web UI
  api/          Control Plane API service
  gateway/      MCP Gateway service
  stdio-adapter/Isolated HTTP-to-stdio MCP adapter runtime
  worker/       Tool scan, schema diff, and health check worker
servers/
  echo/         First-party example MCP server package
  k8s-readonly/ Read-only Kubernetes MCP server package
  internal-docs/Internal documentation MCP server package
  stdio-sample/ First-party stdio MCP server for adapter testing
packages/
  auth/         Auth and principal contracts
  config/       Shared configuration helpers
  db/           Database package boundary
  logger/       Shared logger helper
  mcp-protocol/ MCP protocol contracts
  policy/       Authorization policy contracts
  ui/           Shared UI package
schemas/        OpenAPI, catalog, and policy schema placeholders
deploy/         Helm and GitOps placeholders
docs/           Architecture and operations documentation
scripts/        Local automation entrypoint
tests/          Cross-workspace smoke tests
```

## Local Development

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env` and adjust values for local services.
3. Run all development tasks with `pnpm dev`.
4. Run validation with `pnpm typecheck`, `pnpm lint`, and `pnpm test`.

## Development Order

1. Establish shared schemas, database models, and package contracts.
2. Implement the Control Plane API and worker metadata flow.
3. Implement the MCP Gateway data plane.
4. Add the web UI, first-party MCP servers, auth policy, observability, deployment, CI, and operations documentation in order.
