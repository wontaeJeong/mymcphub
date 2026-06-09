# MVP Demo

Use this checklist when showing the current MCP Hub MVP end to end. It keeps the demo on the supported local commands and the seeded `k8s-readonly` catalog entry.

## Goal

Show that MCP Hub can run a local control plane, expose a protected Gateway, separate user and admin Web routes, provide an internal MCP Market/Registry workflow, generate client configuration, and reset local state without touching shared systems.

## Prerequisites

- Docker is running.
- Go, Node.js, pnpm, and Helm are available.
- Dependencies are installed with `pnpm install`.
- Local environment is copied from `.env.example`:

```sh
cp .env.example .env
```

See [Local Development](LOCAL_DEV.md) for seed IDs, ports, and the full reset flow.

## 1. Start Infrastructure

Start the local support services from `compose.yaml`:

```sh
pnpm dev:infra
```

Expected result:

- Postgres accepts `mcp_hub` connections on `127.0.0.1:5432`.
- Redis responds on `127.0.0.1:6379`.
- Keycloak exposes the local issuer at `http://localhost:8080/realms/mcp-hub`.

Quick fallback if only infra readiness is being checked:

```sh
pnpm dev:smoke-test -- --infra-only
```

## 2. Start The MVP Stack

Run the Go core services and the Web console:

```sh
pnpm dev
```

`pnpm dev` starts:

- API: `http://localhost:4000`
- Gateway: `http://localhost:5000`
- Worker: `http://localhost:4100`
- Kubernetes MCP sample server: `http://localhost:5102`
- Web: `http://localhost:3000`

Health checks:

```sh
curl http://localhost:4000/healthz
curl http://localhost:4000/api/servers
```

Expected result: API health is `ok`, and the server catalog includes `k8s-readonly` with market metadata such as category, tags, install methods, trust level, and visibility.

## 3. Demo The Web Surfaces

Open `http://localhost:3000`.

Expected user flow:

1. Unauthenticated access redirects to `/login`.
2. The local `dev` provider is visible outside production.
3. Continuing as a dev user lands in `/user`, where the MCP Market entry cards summarize discovery, access, and client-config actions.
4. `/user/catalog` shows the internal MCP Market browse surface. Confirm search, category, tag, trust, access, visibility, health, and enabled filters. `/user/market` is not a separate route; use `/user/catalog` for market discovery.
5. Open a server detail page such as `/user/servers/00000000-0000-4000-8000-000000000102` and confirm tools, risk, access status, install guidance, policy dry-run, prerequisites, and security notes.
6. From the detail page, open an access request and confirm `/user/access` is prefilled with server, requested tools, environment, and reason.
7. Open `/user/client-config`, choose the seeded server/client profile, and confirm the generated snippet routes through the Gateway with bearer auth.
8. A non-admin user visiting `/admin` sees the forbidden page.

Expected admin flow:

1. Continuing as a dev admin lands in `/admin`, where market status cards summarize published, draft/internal, missing metadata, and quarantined entries.
2. `/admin/servers` shows the admin market curation table with category/tags, trust level, publish/visibility/quarantine state, docs/install completeness, owner, health, risk, detail, edit, and audit links. `/admin/market` is not a separate route; use `/admin/servers` for curation.
3. Open a server detail page under `/admin/servers/{serverId}` and confirm publish, metadata, runtime, safety, and audit-worthy controls.
4. `/admin/approvals` shows approval workflow controls with decision context: server category/environment/risk, requested tool risk, existing wildcard or overlapping grants, and review-comment requirements.
5. `/admin/audit` and `/admin/operations` show audit, runtime, rollout, health, and quarantine state.
6. `/admin/emergency` shows emergency control surfaces.

Explicitly out of scope for the demo: advertising, sponsored placement, public ranking, popularity ranking, paid marketplace behavior, and skills marketplace behavior.

Fallback if the browser session is stale: submit the logout form or clear the `mcp_hub_session` cookie, then start again from `/login`.

## 4. Demo The Gateway

List tools through the Gateway using the seeded admin token:

```sh
curl http://localhost:5000/mcp/k8s-readonly \
  -H 'authorization: Bearer dev-admin-token' \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Expected result: the response includes tools such as `list_namespaces`, `list_pods`, and `get_pod`.

Negative check:

```sh
curl http://localhost:5000/mcp/k8s-readonly
```

Expected result: the Gateway denies the unauthenticated request.

## 5. Demo The CLI

Check the API and generate a client config through `mcphubctl`:

```sh
go run ./apps/cli/cmd/mcphubctl --api-url http://localhost:4000 health
go run ./apps/cli/cmd/mcphubctl --api-url http://localhost:4000 client config --client opencode --output json
```

Expected result: the CLI talks to the Control Plane API and prints local configuration output; it does not directly mutate DB, Kubernetes, or secrets.

## 6. Run Demo Checks

Before a demo, run the focused repository validation target:

```sh
make demo-check
```

`make demo-check` runs the existing minimum checks:

- `go test ./internal/... ./tests/e2e ./tests/security`
- `pnpm --filter @mcp-hub/web test:unit`
- `pnpm typecheck`
- `pnpm helm:template`

If the full check is too expensive and the stack is already running, use the live smoke check only:

```sh
pnpm dev:smoke-test
```

## 7. Reset Or Stop

Reset local runtime state:

```sh
pnpm dev:reset-db
```

Stop support infrastructure:

```sh
pnpm dev:infra:down
```

If the API returns unexpected seed data, remove the file referenced by `MCP_STORE_PATH` or run `pnpm dev:reset-db`, then restart `pnpm dev`.
