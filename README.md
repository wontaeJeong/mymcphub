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

## Operator Documentation

Use these docs when running, debugging, or onboarding MCP Hub:

| Doc | Use |
| --- | --- |
| [Architecture](docs/ARCHITECTURE.md) | Control Plane, Data Plane, Runtime Plane, and current skeleton limits. |
| [Local Development](docs/LOCAL_DEV.md) | Local infra, ports, mock tokens, smoke tests, and troubleshooting. |
| [Data Model](docs/DATA_MODEL.md) | Planned database boundaries and current in-memory runtime state. |
| [Control Plane API](docs/API.md) | API routes, local curl checks, auth boundary, and admin operations. |
| [Gateway](docs/GATEWAY.md) | Gateway routes, mock tokens, first-party upstreams, policy flow, and metrics. |
| [Policy](docs/POLICY.md) | Auth, grants, approvals, emergency deny, and Gateway enforcement. |
| [Audit and Observability](docs/AUDIT_OBSERVABILITY.md) | Audit search, metrics, redaction, trace ids, and current observability limits. |
| [Security](docs/SECURITY.md) | Security scan commands, manifest review, hardening, and kill-switch endpoints. |
| [Deployment](docs/DEPLOYMENT.md) | Helm, GitOps, secret expectations, auth boundary, and rollback. |
| [Release](docs/RELEASE.md) | Promotion, digest usage, schema diff scope, canary placeholder, and rollback. |
| [Runbook](docs/RUNBOOK.md) | Operator response steps for common incidents and outages. |
| [Client Setup](docs/CLIENT_SETUP.md) | Remote MCP client setup examples and config generator usage. |
| [MCP Server Onboarding](docs/MCP_SERVER_ONBOARDING.md) | Manifest, owner, transport, review, promotion, and monitoring lifecycle. |

## Policy Model

MCP Hub uses mock local auth by default, normalizes principals for the API and Gateway, and evaluates shared policy decisions for connect, tool discovery, tool calls, approvals, and emergency deny scopes. The current skeleton keeps API and Gateway state in memory, while `@mcp-hub/auth` provides package-level OIDC JWT verifier support that is not wired into API or Gateway runtime handling.

See [docs/POLICY.md](docs/POLICY.md) for the implemented auth, policy, approval, and emergency model.

## Kubernetes Deployment

The full MCP Hub Helm chart lives in `deploy/helm/mcp-hub` with default, dev, stg, and prod values files. Install or upgrade with `helm upgrade --install mcp-hub deploy/helm/mcp-hub --namespace mcp-hub --create-namespace -f deploy/helm/mcp-hub/values-dev.yaml`, and roll back with `helm rollback mcp-hub <revision> --namespace mcp-hub`.

GitOps examples for Argo CD or Flux live under `deploy/gitops` and require Kustomize with Helm support, for example `kustomize build --enable-helm deploy/gitops/overlays/dev`. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for secret expectations, environment values, validation, install, upgrade, rollback, and GitOps usage. See [docs/RELEASE.md](docs/RELEASE.md) for dev to stg to prod promotion, Helm digest use, API version metadata checks, the canary placeholder, and rollback. See [docs/SECURITY.md](docs/SECURITY.md) for security scans, MCP manifest review, image digest pinning, egress and service account hardening, and kill-switch operation endpoints.

## Development Order

1. Establish shared schemas, database models, and package contracts.
2. Implement the Control Plane API and worker metadata flow.
3. Implement the MCP Gateway data plane.
4. Add the web UI, first-party MCP servers, auth policy, observability, deployment, CI, and operations documentation in order.
