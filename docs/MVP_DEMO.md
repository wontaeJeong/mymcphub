# MVP Demo

Use this checklist when showing the current MCP Hub MVP end to end. It keeps the demo on the supported local commands and the seeded `k8s-readonly` catalog entry.

## Goal

Show that MCP Hub can run a local control plane, expose a protected Gateway, separate user and admin Web routes, generate client configuration, and reset local state without touching shared systems.

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

Expected result: API health is `ok`, and the server catalog includes `k8s-readonly`.

## 3. Demo The Web Surfaces

Open `http://localhost:3000`.

Expected user flow:

- Unauthenticated access redirects to `/login`.
- The local `dev` provider is visible outside production.
- Continuing as a dev user lands in `/user`.
- `/user/catalog` shows enabled servers and tools.
- `/user/access` shows visible grants and access request controls.
- `/user/client-config` generates MCP client snippets.
- A non-admin user visiting `/admin` sees the forbidden page.

Expected admin flow:

- Continuing as a dev admin lands in `/admin`.
- `/admin/servers` shows server operations.
- `/admin/approvals` shows approval workflow controls.
- `/admin/audit` and `/admin/operations` show audit and runtime views.
- `/admin/emergency` shows emergency control surfaces.

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
