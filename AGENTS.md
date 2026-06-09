# AGENTS.md

## Read first

- Trust executable config over prose: `Makefile`, `package.json`, `.github/workflows/ci.yaml`, and `scripts/ci/*` define the active validation lanes.
- For context, open the smallest relevant doc: `docs/ARCHITECTURE.md`, `docs/LOCAL_DEV.md`, `docs/API.md`, `docs/CLI.md`, `docs/DEPLOYMENT.md`, or `docs/TESTING.md`.
- Only this root `AGENTS.md` exists; there are no nested repo instruction files to merge.

## Architecture boundaries

- Go owns runtime code: `apps/api`, `apps/worker`, `apps/cli`, `internal/*`, and development fixtures under `dev/*`.
- TypeScript is Web-only: `apps/web` and `packages/ui`. Do not add TypeScript server/operator runtimes unless explicitly requested.
- Active TypeScript workspace packages are only `apps/web` and `packages/ui` from `pnpm-workspace.yaml`; ignore generated/local artifacts such as `dist`, `.next`, and `node_modules`.
- Entrypoints are `apps/api/cmd/api`, `apps/worker/cmd/worker`, and `apps/cli/cmd/mcphubctl`.
- Operator actions should go through the Control API, Web UI, or `mcphubctl`; scripts are CI helpers only.

## Toolchain and commands

- Required versions in CI/config: Go `1.26.4` (`go.mod` says `go 1.26`), Node `22`, pnpm `10.12.1`.
- Setup/start from repo root: `pnpm install`, `make infra-up`, `cp .env.example .env`, `make migrate`, then `make dev`.
- `make dev` starts API `:4000`, Worker `:4100`, and Next.js Web `:3000`.
- Go services read the generic `PORT`; `make dev` sets `PORT` per process.
- Use `pnpm run ci` or `make ci` for the aggregate CI script; bare `pnpm ci` is pnpm's clean-install command, not this repo's CI.
- Root checks: `make lint`, `make test`, `make build`, and `make ci`.
- `make build` and CI build API, Worker, CLI, and Web.
- Focused Go checks: `go test ./internal/<pkg>`, `go test ./apps/api/cmd/api`, `go test ./apps/worker/cmd/worker`, or `go test ./apps/cli/cmd/mcphubctl`.
- Focused Web checks: `pnpm --filter @mcp-hub/web test`, `typecheck`, `lint`, or `build`; use `@mcp-hub/ui` for the shared UI package.
- `pnpm typecheck` runs UI then Web typechecks; `scripts/ci/web.sh` runs typecheck, test, and build for both workspaces.
- `make helm-template` requires `helm`; `scripts/ci/helm.sh` runs Helm lint and render.
- Avoid `pnpm format` or whole-repo formatting unless requested.

## Runtime state and local auth

- Service entrypoints call `db.OpenRepository(context.Background(), cfg.DatabaseURL)` and use PostgreSQL when `DATABASE_URL` is reachable.
- If the configured database cannot be opened or does not have the expected catalog tables, API and Worker fall back to `db.NewMemoryRepository()` for local execution.
- Reset local PostgreSQL state through migrations or database cleanup; in-memory fallback state resets when the process exits.
- Local mock tokens are `dev-admin-token` and `dev-readonly-token`. Keep fixture/docs examples limited to these mock values.
- Worker `POST /jobs/run` requires a platform-admin bearer token or `MCP_WORKER_JOB_TOKEN`, and the body must be one JSON job array.

## MCP Hub security constraints

- Treat MCP server metadata, upstream URLs, stdio commands, and capability snapshots as untrusted input.
- Server-side stdio execution must remain disabled unless explicitly enabled by `MCPHUB_ENABLE_SERVER_STDIO_EXEC=true`.
- Server mutations, capability sync, runtime status, and job APIs require platform-admin context and audit-worthy behavior.
- Never commit raw secret/token/password/client-secret values in docs, tests, logs, Helm values, or fixtures.

## Manual QA surfaces

- CLI: `go run ./apps/cli/cmd/mcphubctl --help`, `version`, or `--api-url http://localhost:4000 health`.
- API: run `go run ./apps/api/cmd/api`, then `curl http://localhost:4000/healthz` and a focused `/api/*` route.
- Web: run API plus `pnpm --filter @mcp-hub/web dev`; catalog routes are `/catalog` and `/servers/[serverId]`.
- Worker: run `go run ./apps/worker/cmd/worker`, then trigger `/jobs/run` with an authorized JSON array.
