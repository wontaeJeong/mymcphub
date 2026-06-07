# MCP Hub

MCP Hub is an internal platform skeleton for managing MCP server catalog entries, a Go Control Plane API, a Go MCP Gateway data plane, Go worker jobs, a Go operator CLI, a TypeScript Next.js web console, and Go first-party MCP servers.

## Workspace Structure

```txt
apps/
  web/          TypeScript / Next.js operations console
  api/          Go Control Plane API service
  gateway/      Go MCP Gateway service
  worker/       Go background worker service
  cli/          Go mcphubctl operator CLI
servers/
  k8s/          Go read-only Kubernetes MCP server
internal/       Go shared auth, audit, config, db, policy, MCP, redaction, telemetry packages
schemas/        OpenAPI and JSON Schema source of truth
deploy/         Helm chart and GitOps overlays
docs/           Architecture, operation, security, and runbook documentation
scripts/        dev, ci, gen, release, and deprecated helper scripts only
tests/          Go e2e/security tests and TS contract smoke tests
```

## Local Development

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env` and adjust local values.
3. Start support infrastructure with `pnpm dev:infra`.
4. Run the Go core plus web stack with `pnpm dev`.
5. Validate with `make lint`, `make test`, `make build`, and `make ci`.

Use `go run ./apps/cli/cmd/mcphubctl --api-url http://localhost:4000 health` to check the local API through the CLI.

## Operator Documentation

Use these docs when running or extending MCP Hub:

| Doc | Use |
| --- | --- |
| [Architecture](docs/ARCHITECTURE.md) | Go core, Web UI, schemas, and runtime planes. |
| [Contracts](docs/CONTRACTS.md) | OpenAPI, JSON Schema, generated Web client, and error envelope. |
| [Control Plane API](docs/API.md) | Go API routes and local curl checks. |
| [Gateway](docs/GATEWAY.md) | Go MCP Gateway auth, policy, redaction, and proxy behavior. |
| [Worker](docs/WORKER.md) | Go worker jobs and manual trigger endpoint. |
| [CLI](docs/CLI.md) | `mcphubctl` command guide. |
| [Local Development](docs/LOCAL_DEV.md) | Local stack, seed data, MCP Inspector, and reset flow. |
| [Operations](docs/OPERATIONS.md) | Day-2 operating model. |
| [Runbooks](docs/RUNBOOKS.md) | Gateway, upstream, auth, policy, schema drift, and quarantine response. |
| [Testing](docs/TESTING.md) | Go, TS, e2e, security, schema, and Helm validation. |
| [Deployment](docs/DEPLOYMENT.md) | Helm/GitOps deployment for Go images. |
| [Rollback](docs/ROLLBACK.md) | Roll back to previous Go image tags. |
| [MCP Server Matrix](docs/MCP_SERVER_LANGUAGE_MATRIX.md) | First-party server language decisions. |

## Contracts

`schemas/openapi/mcp-hub.openapi.yaml` is the Control Plane API contract. `schemas/jsonschema/` contains manifest, policy, audit event, grant request, and client profile schemas. The Web UI consumes the generated boundary at `apps/web/lib/generated/mcp-hub-client.ts`.

## Development Order

1. Update neutral schemas.
2. Implement Go API, Gateway, Worker, and CLI behavior.
3. Keep Web in TypeScript and consume the generated API client.
4. Keep first-party MCP servers in Go unless the user explicitly adds another non-Web runtime.
5. Validate with Go/Web UI tests, security negatives, schema checks, Helm rendering, and manual HTTP/CLI QA.
