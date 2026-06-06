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
deploy/         Helm chart, GitOps overlays, and deployment examples
docs/           Architecture and operations documentation
scripts/        Local automation entrypoint
tests/          Cross-workspace smoke tests
```

## Local Development

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env` and adjust values for local services.
3. Start local support infrastructure with `pnpm dev:infra`.
4. Run database setup with `pnpm db:migrate` and `pnpm db:seed`.
5. Run the local app stack with `pnpm dev`.
6. Run validation with `pnpm dev:smoke-test`, `pnpm typecheck`, `pnpm lint`, and `pnpm test`.

See [docs/LOCAL_DEV.md](docs/LOCAL_DEV.md) for the complete local infra, database, mock token, smoke-test, and troubleshooting guide.

## Policy Model

MCP Hub uses mock local auth by default, normalizes principals for the API and Gateway, and evaluates shared policy decisions for connect, tool discovery, tool calls, approvals, and emergency deny scopes. The current skeleton keeps API and Gateway state in memory, while `@mcp-hub/auth` provides package-level OIDC JWT verifier support that is not wired into API or Gateway runtime handling.

See [docs/POLICY.md](docs/POLICY.md) for the implemented auth, policy, approval, and emergency model.

## Kubernetes Deployment

The full MCP Hub Helm chart lives in `deploy/helm/mcp-hub` with default, dev, stg, and prod values files. Install or upgrade with `helm upgrade --install mcp-hub deploy/helm/mcp-hub --namespace mcp-hub --create-namespace -f deploy/helm/mcp-hub/values-dev.yaml`, and roll back with `helm rollback mcp-hub <revision> --namespace mcp-hub`.

GitOps examples for Argo CD or Flux live under `deploy/gitops` and require Kustomize with Helm support, for example `kustomize build --enable-helm deploy/gitops/overlays/dev`. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for secret expectations, environment values, validation, install, upgrade, rollback, and GitOps usage. See [docs/SECURITY.md](docs/SECURITY.md) for security scans, MCP manifest review, image digest pinning, egress and service account hardening, and kill-switch operation endpoints.

## Development Order

1. Establish shared schemas, database models, and package contracts.
2. Implement the Control Plane API and worker metadata flow.
3. Implement the MCP Gateway data plane.
4. Add the web UI, first-party MCP servers, auth policy, observability, deployment, CI, and operations documentation in order.
