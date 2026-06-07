# MCP Hub Architecture

MCP Hub is a TypeScript monorepo skeleton for an MCP control plane, Gateway data plane, worker jobs, and first-party MCP servers. The current implementation is suitable for local development, contract checks, and operations workflow design. It does not yet provide durable API or Gateway runtime persistence, Redis-backed queues, runtime JWKS verification in API/Gateway, or real canary traffic splitting.

## Workspace Map

| Path | Role |
| --- | --- |
| `apps/web` | Next.js operator and developer UI at `http://localhost:3000`. |
| `apps/api` | Control Plane API at `http://localhost:4000`. |
| `apps/gateway` | MCP Gateway at `http://localhost:5000`. |
| `apps/worker` | Tool scan, schema diff, health, audit, and metrics skeleton. |
| `apps/stdio-adapter` | HTTP-to-stdio adapter for stdio MCP servers. |
| `servers/*` | First-party MCP server packages and manifests. |
| `packages/*` | Shared auth, policy, protocol, database, config, logger, and UI packages. |
| `deploy/helm/mcp-hub` | Main Helm chart for Web, API, Gateway, and Worker. |
| `docs/*` | Operator documentation and runbooks. |

## Control Plane

The Control Plane contains `apps/api`, `apps/web`, and `apps/worker`.

- `apps/api` owns catalog, grant, approval, and audit-search APIs.
- `apps/web` provides the operator and developer interface.
- `apps/worker` runs tool scans, schema diffs, health checks, and risk classification jobs.

The API store is in memory in this skeleton. The Worker has a schema diff helper and metrics skeleton, but no real runtime MCP `tools/list` scanner is wired yet.

## Data Plane

The Data Plane contains `apps/gateway`, managed first-party MCP servers under `servers/*`, stdio adapter workloads, and external remote MCP servers.

The gateway is responsible for token validation, session routing, tool-list filtering, tool-call authorization, audit logging, timeout handling, and upstream health awareness.

The Gateway registry, grants, emergency state, audit events, and metrics are in memory in this skeleton. Gateway metrics are available at `http://localhost:5000/metrics`; the Gateway has no `/healthz` route today.

The stdio adapter runtime in `apps/stdio-adapter` is the only component that spawns stdio MCP server processes. Gateway registrations with transport `stdio_adapter` still point at an HTTP JSON-RPC upstream URL, such as `http://localhost:5103/mcp`, so the gateway remains a pure HTTP proxy and does not import subprocess logic.

## Runtime Plane

The Runtime Plane is where managed MCP servers and stdio adapter pods execute. It keeps tool execution separate from the Control Plane so operators can disable servers, tools, grants, or emergency policies without redeploying the web or API services.

Each stdio adapter instance owns one child process, preserves newline-delimited stdin/stdout JSON-RPC frames, collects stderr as health/status logs, and serializes requests through a FIFO queue with timeout and queue-depth limits.

## Dependency Direction

Shared packages under `packages/*` provide contracts and utilities used by apps and servers. Control Plane packages should not depend on Data Plane runtime implementations. Gateway policy checks should use shared contracts from `packages/auth`, `packages/mcp-protocol`, and `packages/policy`.

## Operator Entry Points

| Surface | Local URL |
| --- | --- |
| Web UI | `http://localhost:3000` |
| API health | `http://localhost:4000/healthz` |
| API readiness | `http://localhost:4000/readyz` |
| Gateway echo route | `http://localhost:5000/mcp/echo` |
| Gateway metrics | `http://localhost:5000/metrics` |
| Echo server | `http://localhost:5100` |
| Internal docs server | `http://localhost:5101` |
| Kubernetes read-only server | `http://localhost:5102` |
| Stdio adapter | `http://localhost:5103` |

Key Web pages are `/catalog`, `/servers/:serverId`, `/tools`, `/access`, `/approvals`, `/audit`, `/operations`, `/admin`, and `/client-config`.

## Related Docs

See [API.md](API.md), [GATEWAY.md](GATEWAY.md), [RUNBOOK.md](RUNBOOK.md), and [MCP_SERVER_ONBOARDING.md](MCP_SERVER_ONBOARDING.md) for operator procedures.
