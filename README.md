# MCP Hub

MCP Hub is an internal catalog for MCP servers owned by teams in an organization. Hub does not host MCP servers. Each MCP server development team operates the real server; Hub stores metadata, ownership, liveness, capability snapshots, and sync history.

Supported transports:

- `streamable_http`: API/Worker can sync capabilities from the remote endpoint.
- `stdio`: `mcphubctl` runs the local process, collects capabilities, and uploads a snapshot. Server-side stdio execution is disabled unless `MCPHUB_ENABLE_SERVER_STDIO_EXEC=true`.

## Workspace

```txt
apps/web       read-only catalog UI
apps/api       catalog/control API
apps/worker    streamable_http health and capability sync
apps/cli       mcphubctl admin CLI
internal       auth, config, db repository, MCP client, API, worker, CLI helpers
packages/ui    shared UI package
migrations     PostgreSQL SQL migrations
deploy/helm    Web/API/Worker chart
docs           operating docs
```

## Local development

```sh
pnpm install
make infra-up
cp .env.example .env
make migrate
make dev
```

Validate with:

```sh
make lint
make test
make build
make ci
make helm-template
```
