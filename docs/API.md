# Control Plane API

The Control Plane API runs from `apps/api` and listens on `http://localhost:4000` in local development. It exposes catalog, versions, grants, approvals, audit search, client config, health, metrics, and emergency administration routes.

The current skeleton uses an in-memory store. Server catalog entries, tools, versions, grants, approvals, audit events, tool-call events, health records, and emergency deny state are reset when the API process restarts. Postgres is available as support infrastructure and the database package has model boundaries, but the API runtime state is not fully persisted through Postgres yet.

## Local Checks

```sh
curl http://localhost:4000/healthz
curl http://localhost:4000/readyz
curl http://localhost:4000/api/me
curl http://localhost:4000/api/servers
curl 'http://localhost:4000/api/audit-events?limit=10'
```

Use `pnpm dev:smoke-test` for the local happy path. It checks API health, readiness, seeded catalog data, Gateway access, and API audit ingest/query behavior.

## Authentication Boundary

Local development uses mock auth by default. The API creates a platform-admin style mock context unless `MCP_AUTH_MODE=oidc` is set. In `oidc` mode, the API reads trusted identity headers such as `x-user-id`, `x-user-email`, `x-team-ids`, `x-groups`, `x-roles`, `x-principal-type`, and `x-client-id`.

`@mcp-hub/auth` includes an OIDC JWT verifier, but API runtime JWKS verification is not wired in this skeleton. Shared deployments must put the API behind a trusted auth proxy or ingress that verifies identity, strips client-supplied identity headers, and injects trusted headers.

## Endpoint Map

| Endpoint | Purpose | Notes |
| --- | --- | --- |
| `GET /healthz` | Liveness check | Returns API process status. |
| `GET /readyz` | Readiness check | Local readiness check for API dependencies. |
| `GET /metrics` | Prometheus text metrics | Exposes `mcp_api_requests_total`. |
| `GET /api/me` | Current auth context | Useful for checking mock or proxy-injected identity. |
| `GET /api/servers` | List catalog servers | In-memory catalog. |
| `POST /api/servers` | Create catalog server | Platform admin only. |
| `GET /api/servers/:serverId` | Get one server | Used by Web server detail pages. |
| `PATCH /api/servers/:serverId` | Update server fields | Platform admin only. |
| `POST /api/servers/:serverId/disable` | Disable one server | Platform admin only; kill-switch route. |
| `POST /api/servers/:serverId/enable` | Enable one server | Platform admin only. |
| `GET /api/servers/:serverId/versions` | List server versions | In-memory release metadata. |
| `POST /api/servers/:serverId/versions` | Create server version | Platform admin only; does not deploy Kubernetes resources. |
| `POST /api/servers/:serverId/versions/:versionId/activate` | Activate version metadata | Platform admin only; metadata only. |
| `POST /api/servers/:serverId/versions/:versionId/rollback` | Roll back version metadata | Platform admin only; metadata only. |
| `GET /api/servers/:serverId/schema-diff` | Read schema diff placeholder | Worker scanner is not wired to runtime `tools/list` yet. |
| `GET /api/servers/:serverId/tools` | List tools for a server | In-memory tool records. |
| `PATCH /api/servers/:serverId/tools/:toolId` | Update tool fields | Platform admin only. |
| `POST /api/servers/:serverId/tools/:toolId/disable` | Disable one tool | Platform admin only; kill-switch route. |
| `POST /api/servers/:serverId/tools/:toolId/enable` | Enable one tool | Platform admin only. |
| `GET /api/grants` | List grants | In-memory grants. |
| `POST /api/grants` | Create grant | Platform admin only. |
| `PATCH /api/grants/:grantId` | Update grant | Platform admin only. |
| `POST /api/grants/:grantId/revoke` | Revoke grant | Platform admin only. |
| `GET /api/approvals` | List approvals | In-memory approvals. |
| `POST /api/approvals` | Create approval request | Creates a pending approval. |
| `POST /api/approvals/:approvalId/approve` | Approve request | Platform admin only; creates a grant from approval data. |
| `POST /api/approvals/:approvalId/reject` | Reject request | Platform admin only. |
| `GET /api/audit-events` | Search audit events | Supports filters and cursor paging. |
| `POST /api/audit-events/gateway` | Ingest Gateway-style audit event | Platform admin only, in-memory only. |
| `GET /api/tool-call-events` | List tool-call events | Used by Web audit views. |
| `GET /api/server-health` | List server health | Used by Web operations views. |
| `POST /api/client-config/generate` | Generate client config snippet | Supports `generic`, `opencode`, `claude-code`, `codex`, and `vscode`. |
| `POST /api/admin/emergency-deny` | Enable emergency deny | Platform admin only. |
| `POST /api/admin/emergency-deny/disable` | Disable emergency deny | Platform admin only. |
| `POST /api/admin/revoke-server-grants/:serverId` | Revoke enabled grants for one server | Platform admin only. |

## Common Operator Requests

Generate an opencode client snippet for the seeded echo server:

```sh
curl -X POST http://localhost:4000/api/client-config/generate \
  -H 'content-type: application/json' \
  -d '{"client":"opencode","serverId":"00000000-0000-4000-8000-000000000100"}'
```

Enable a scoped emergency deny for a server slug:

```sh
curl -X POST http://localhost:4000/api/admin/emergency-deny \
  -H 'content-type: application/json' \
  -d '{"reason":"operator incident response","serverSlugs":["echo"]}'
```

Disable emergency deny after recovery:

```sh
curl -X POST http://localhost:4000/api/admin/emergency-deny/disable
```

Revoke enabled grants for one server:

```sh
curl -X POST http://localhost:4000/api/admin/revoke-server-grants/00000000-0000-4000-8000-000000000100
```

## Web Pages That Use The API

Operators normally use the Web app at `http://localhost:3000` for day-to-day checks:

| Page | API surface |
| --- | --- |
| `/catalog` | `/api/servers` |
| `/servers/:serverId` | `/api/servers/:serverId`, tools, versions, audit, and health routes |
| `/tools` | Server and tool lists |
| `/access` | Grants and approvals |
| `/approvals` | Approval review |
| `/audit` | `/api/audit-events` and `/api/tool-call-events` |
| `/operations` | `/api/server-health` |
| `/admin` | Kill-switch and emergency routes |
| `/client-config` | `/api/client-config/generate` |

## OpenAPI

The checked-in OpenAPI skeleton is at `schemas/openapi/control-plane.openapi.json`. To regenerate from the API package, run:

```sh
pnpm --filter @mcp-hub/api openapi:write
```
