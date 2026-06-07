# Local Development

Use Docker Compose for support services and Go for core services.

For a demo-focused walkthrough, use [MVP Demo](MVP_DEMO.md). For service-specific commands, see the READMEs under `apps/`.

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

API, Gateway, and Worker share local runtime state through `MCP_STORE_PATH` (default: `/tmp/mcp-hub/store.json` when unset). Remove that file or run `pnpm dev:reset-db` to reset only the Go runtime catalog/audit/health state.

## Seed Data

Local seed data is code-backed in `internal/db.NewSeedStore` and mirrored for tests/Web fixtures in `tests/fixtures/local-seed.json`.

| Seed          | Value                                                        |
| ------------- | ------------------------------------------------------------ |
| Admin user    | `00000000-0000-4000-8000-000000000001` / `admin@example.com` |
| Platform team | `00000000-0000-4000-8000-000000000010`                       |
| Local project | `00000000-0000-4000-8000-000000000020`                       |
| MCP server    | `k8s-readonly` / `00000000-0000-4000-8000-000000000102`      |
| Granted tools | `list_namespaces`, `list_pods`, `get_pod`                    |
| Local grant   | `00000000-0000-4000-8000-000000000200`                       |

Mock tokens:

```sh
pnpm dev:create-mock-token -- admin
pnpm dev:create-mock-token -- readonly
```

`pnpm dev:seed` prints the seed source of truth. It does not directly mutate PostgreSQL, Kubernetes, or secrets.

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
pnpm dev:smoke-test
```

`pnpm dev:smoke-test` expects the local stack and Compose infrastructure to be running. The Go test suites under `tests/contract`, `tests/e2e`, `tests/load`, and `tests/migration` are offline and do not need running services.
