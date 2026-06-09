# MCP Hub Web

`apps/web` is the Next.js App Router console for MCP Hub. It separates user self-service routes from admin-only operations routes and supports configuration-driven login providers.

## Run Locally

From the repository root:

```sh
pnpm install
go run ./apps/api/cmd/api
pnpm --filter @mcp-hub/web dev
```

The web app defaults to the local Control Plane API at `http://localhost:4000`. If the API is offline or an endpoint returns an error, the UI renders error or empty states instead of mock data.

## Routes

- User: `/user`, `/user/catalog`, `/user/access`, `/user/servers/[serverId]`
- Admin: `/admin`, `/admin/servers`, `/admin/approvals`, `/admin/audit`, `/admin/operations`, `/admin/emergency`

Unauthenticated users are sent to `/login`. Authenticated non-admin users get a clear forbidden state for admin pages.

## Environment

Set either variable to point the web app at another Control Plane API base URL:

```sh
MCP_API_URL=http://localhost:4000
NEXT_PUBLIC_MCP_API_URL=http://localhost:4000

MCP_WEB_AUTH_ENABLED_PROVIDERS=dev
MCP_WEB_SESSION_SECRET=dev-only-change-me
MCP_WEB_SESSION_COOKIE_NAME=mcp_hub_session
MCP_WEB_SESSION_TTL_SECONDS=28800
```

`MCP_API_URL` is preferred for server-side requests. `NEXT_PUBLIC_MCP_API_URL` is also supported for deployments that already expose a public API base URL.

For production login, set one or more Web providers:

- `local`: `MCP_WEB_LOCAL_AUTH_ENABLED=true` plus `MCP_WEB_LOCAL_USERS` or `MCP_WEB_LOCAL_ADMIN_*` with a `scrypt$...` password hash.
- `oidc`: add provider ids to `MCP_WEB_AUTH_ENABLED_PROVIDERS` and configure `MCP_WEB_OIDC_<ID>_*` issuer/client/scopes/admin mapping variables.
- `dev`: local development only; never enabled by default in production.

OIDC provider secrets and `MCP_WEB_SESSION_SECRET` must be server-only values. Do not use `NEXT_PUBLIC_*` for client secrets or session secrets.

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

See also:

- [Local Development](../../docs/LOCAL_DEV.md)
- [MVP Demo](../../docs/MVP_DEMO.md)
- [Web Auth Route Split](../../docs/WEB_AUTH_ROUTE_SPLIT.md)
