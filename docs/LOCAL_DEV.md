# Local Development

This guide covers the local development flow for MCP Hub. It starts local-only support infrastructure with Docker Compose, then runs the existing API, Gateway, web app, worker, and HTTP first-party MCP servers from the monorepo.

## Prerequisites

- Node.js and pnpm matching the repo package manager declaration, `pnpm@10.12.1`.
- Docker with the Compose v2 plugin available as `docker compose`.
- `curl` for smoke tests.
- Optional: `jq` or other JSON tools for manual inspection. The provided smoke script uses Node.js instead.

## Quickstart

Run these commands from the repository root:

```sh
pnpm install
pnpm dev:infra
pnpm db:migrate
pnpm db:seed
pnpm dev
```

In another terminal, after the app services are listening, run:

```sh
pnpm dev:smoke-test
```

## Environment

Copy the example environment if you want a local `.env` file:

```sh
cp .env.example .env
```

The local defaults are safe development values:

```txt
DATABASE_URL=postgres://mcp:mcp@localhost:5432/mcp_hub
REDIS_URL=redis://localhost:6379
OIDC_ISSUER_URL=http://localhost:8080/realms/mcp-hub
OIDC_CLIENT_ID=mcp-hub-web
OIDC_CLIENT_SECRET=dev-secret
MCP_AUTH_MODE=mock
```

`MCP_AUTH_MODE=mock` is intentional for local development. `@mcp-hub/auth` includes OIDC JWT verifier support, but the API and Gateway do not wire runtime JWKS verification in this skeleton.

## Local Infrastructure

Start Postgres, Redis, and the local Keycloak OIDC provider:

```sh
pnpm dev:infra
```

Start the optional OpenTelemetry collector too:

```sh
scripts/dev/up-infra.sh --otel
```

Check only the local support infrastructure:

```sh
pnpm dev:smoke-test -- --infra-only
```

Stop local infrastructure without deleting data:

```sh
pnpm dev:infra:down
```

Stop local infrastructure and remove compose volumes:

```sh
scripts/dev/down-infra.sh --volumes
```

`--volumes` deletes the local Postgres and Redis compose volumes. Do not use it if you want to keep local data.

## Database

Run migrations against the default local database when `DATABASE_URL` is absent:

```sh
pnpm db:migrate
```

Seed the local database:

```sh
pnpm db:seed
```

Reset only the compose-local `mcp_hub` database, then run migration and seed:

```sh
pnpm dev:reset-db
```

The reset script talks to the `postgres` compose service and recreates only the `mcp_hub` database. It does not use an arbitrary external `DATABASE_URL` for destructive reset.

## App Services

Run the local app stack:

```sh
pnpm dev
```

The smoke test expects these local services to be running:

```txt
web:            http://localhost:3000
api:            http://localhost:4000
gateway:        http://localhost:5000
echo:           http://localhost:5100
internal-docs:  http://localhost:5101
k8s-readonly:   http://localhost:5102
```

`pnpm dev` starts the web app, API, Gateway, worker, echo, internal-docs, and k8s-readonly services. The smoke path uses the API, Gateway, and echo server; the other HTTP first-party servers are started because the Gateway registry references their default ports.

The stdio sample is adapter-backed and needs a built child process plus adapter environment. Start it separately only when you need the `stdio-sample` Gateway route:

```sh
pnpm dev:stdio-adapter
```

This command builds `@mcp-hub/server-stdio-sample` and starts the stdio adapter on `http://localhost:5103/mcp` with `servers/stdio-sample/dist/index.js` as the child process.

## Smoke Test

Run the full local smoke test after `pnpm dev` has started the app services:

```sh
pnpm dev:smoke-test
```

The script verifies:

- Postgres readiness through the compose `postgres` service.
- Redis `PING` through the compose `redis` service.
- OIDC discovery at `http://localhost:8080/realms/mcp-hub/.well-known/openid-configuration`.
- API health at `http://localhost:4000/healthz`.
- API readiness at `http://localhost:4000/readyz`.
- Seeded API catalog includes the `echo` server at `http://localhost:4000/api/servers`.
- Echo upstream health at `http://localhost:5100/health`.
- Gateway authenticated `GET http://localhost:5000/mcp/echo`.
- Gateway `tools/list` for `echo_message`.
- Gateway allowed `echo_message` call.
- Gateway missing and invalid bearer-token failures.
- Gateway denied `missing_tool` call.
- API Gateway audit ingest through `POST /api/audit-events/gateway` and query through `GET /api/audit-events?...`.

Gateway runtime audit events are kept inside the running Gateway process and are not externally queryable, so the smoke script verifies the API audit ingest/query path with a synthetic Gateway-style audit event.

## Mock Tokens

The Gateway uses existing static mock bearer tokens for local development:

```sh
pnpm dev:create-mock-token
pnpm dev:create-mock-token -- readonly
```

Token values:

```txt
admin:    dev-admin-token
readonly: dev-readonly-token
```

Example Gateway call:

```sh
curl http://localhost:5000/mcp/echo \
  -H 'authorization: Bearer dev-admin-token' \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Local Ports

```txt
web:            3000
api:            4000
gateway:        5000
postgres:       5432
redis:          6379
OIDC Keycloak:  8080
echo:           5100
internal-docs:  5101
k8s-readonly:   5102
stdio-adapter:  5103 (optional via `pnpm dev:stdio-adapter`)
OTel gRPC:      4317
OTel HTTP:      4318
```

Compose binds support infrastructure to `127.0.0.1` only.

## Troubleshooting

- API checks: `curl http://localhost:4000/healthz` and `curl http://localhost:4000/readyz`.
- Gateway checks: `curl http://localhost:5000/metrics` and `curl http://localhost:5000/mcp/echo -H 'authorization: Bearer dev-admin-token'`.
- If `pnpm dev:infra` fails on a port bind, another local Postgres, Redis, or Keycloak process is already using the port. Stop it or change the conflicting process.
- If Keycloak takes longer to start, inspect it with `docker compose logs keycloak` and rerun the smoke test after the realm is imported.
- If Postgres or Redis checks fail, inspect `docker compose logs postgres` or `docker compose logs redis`.
- If `pnpm db:migrate` says `DATABASE_URL` is required, run it through the root script so the local default is applied.
- If full smoke fails at Gateway calls, confirm `pnpm dev` is still running and the echo server is listening on `http://localhost:5100/health`.
- If the `stdio-sample` Gateway route fails, run `pnpm dev:stdio-adapter` in another terminal; it is not part of the default `pnpm dev` stack because the adapter needs explicit child-process configuration.
- If infra-only smoke fails because `docker compose exec` cannot find a service, start infra with `pnpm dev:infra` first.

## Caveats

- Postgres, Redis, Keycloak, and the optional OTel collector are local support infrastructure only.
- The API runtime store is in memory for catalog, versions, grants, approvals, audit, tool-call events, health, and emergency deny state.
- The Gateway registry, grants, emergency state, audit events, and metrics are in memory.
- The current skeleton does not wire API or Gateway runtime state to Postgres.
- The current skeleton does not add Redis queue or cache runtime behavior.
- The current skeleton does not implement real OIDC JWT validation for API or Gateway runtime requests.
- The local Keycloak realm exists so local OIDC URLs and discovery are available for development docs and future integration work.

See [RUNBOOK.md](RUNBOOK.md) for operator incident procedures and [CLIENT_SETUP.md](CLIENT_SETUP.md) for local client setup examples.
