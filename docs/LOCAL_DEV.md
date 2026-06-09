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

## Corporate proxy and CA placeholders

For development from an internal corporate network, set `HTTP_PROXY`, `HTTPS_PROXY`, and `NO_PROXY` in `.env` or pass them as Docker build args. Dockerfiles consume those proxy values only in build stages so dependency downloads can reach internal mirrors or external registries; the final runtime images do not set proxy environment variables.

If internal TLS inspection or private package registries require a corporate trust anchor, place PEM-encoded `.crt` files under `deploy/certs/` before building images. The placeholder directory is copied into both build and runtime image stages, and `update-ca-certificates` runs only when non-empty `.crt` files are present. Do not commit private or sensitive certificate material unless it has been approved for repository distribution.

Example image build behind a corporate proxy:

```sh
docker build \
  --build-arg HTTP_PROXY="$HTTP_PROXY" \
  --build-arg HTTPS_PROXY="$HTTPS_PROXY" \
  --build-arg NO_PROXY="$NO_PROXY" \
  -f apps/api/Dockerfile \
  -t mcp-hub/api:dev .
```

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

The seeded `k8s-readonly` entry also carries internal MCP Market metadata for local UX checks: category `cloud_infra`, trust level `platform_supported`, visibility `published`, install method `gateway`, Kubernetes/platform tags, and docs/install/security copy. These fields drive `/user/catalog`, `/user/servers/{serverId}`, `/admin/servers`, approval context, and client-config preselect demos.

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

`pnpm dev:smoke-test` expects the local stack and Compose infrastructure to be running. It checks API readiness, catalog market metadata, server health, Gateway auth/tool calls, client-config generation through `/api/client-config/generate`, and audit creation/query. The Go test suites under `tests/contract`, `tests/e2e`, `tests/load`, and `tests/migration` are offline and do not need running services.
