# Local Development

Use Docker Compose for support services and Go for core services.

```sh
pnpm install
cp .env.example .env
pnpm dev:infra
pnpm dev
```

`pnpm dev` runs:

- Go API on `http://localhost:4000`
- Go Gateway on `http://localhost:5000`
- Go Worker on `http://localhost:4100`
- Go Kubernetes MCP server on `http://localhost:5102`
- Next.js Web on `http://localhost:3000`

API, Gateway, and Worker share local runtime state through `MCP_STORE_PATH` (default: `/tmp/mcp-hub/store.json` when unset). Remove that file to reset only the Go runtime catalog/audit/health state.

MCP Inspector can connect to `http://localhost:5000/mcp/k8s-readonly` with `Authorization: Bearer dev-admin-token`.

Local CLI profile:

```sh
go run ./apps/cli/cmd/mcphubctl --api-url http://localhost:4000 login --profile local
go run ./apps/cli/cmd/mcphubctl --profile local health
```

Validation:

```sh
make lint
make test
make build
```
