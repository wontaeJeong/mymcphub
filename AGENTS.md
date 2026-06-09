# AGENTS.md

## Read first

- Trust executable config over prose: `Makefile`, `package.json`, `.github/workflows/ci.yaml`, and `scripts/ci/*` define the active validation lanes.
- For context, open the smallest relevant doc: `docs/ARCHITECTURE.md`, `docs/DEVELOPER_GUIDE.md`, `docs/CONTRACTS.md`, `docs/TESTING.md`, `docs/LOCAL_DEV.md`, or `docs/SECURITY.md`.
- Only this root `AGENTS.md` exists; there are no nested repo instruction files to merge.

## Architecture boundaries

- Go owns runtime code: `apps/api`, `apps/gateway`, `apps/worker`, `apps/cli`, `internal/*`, and first-party MCP servers under `servers/*`.
- TypeScript is Web-only: `apps/web` and `packages/ui`. Do not add TypeScript server/operator runtimes unless explicitly requested.
- Active TypeScript workspace packages are only `apps/web` and `packages/ui` from `pnpm-workspace.yaml`; ignore generated/local artifacts such as `dist`, `.next`, `.turbo`, and `node_modules`.
- Entrypoints are `apps/api/cmd/api`, `apps/gateway/cmd/gateway`, `apps/worker/cmd/worker`, `apps/cli/cmd/mcphubctl`, and server `cmd/*` packages.
- Operator actions should go through Control Plane API, Gateway, Web UI, or `mcphubctl`; scripts are local dev, CI, generation, security, or release helpers only.

## Toolchain and commands

- Required versions in CI/config: Go `1.26.4` (`go.mod` says `go 1.26`), Node `22`, pnpm `10.12.1`.
- Setup/start from repo root: `pnpm install`, `cp .env.example .env`, `pnpm dev:infra`, then `pnpm dev`.
- `pnpm dev` starts API `:4000`, Gateway `:5000`, Worker `:4100`, k8s MCP server `:5102`, and Next.js Web `:3000`.
- Go services read the generic `PORT`; `pnpm dev` sets `PORT` per process. Do not assume `.env.example` names like `API_PORT` or `GATEWAY_PORT` are wired unless code changes too.
- Use `pnpm run ci` or `make ci` for the aggregate CI script; bare `pnpm ci` is pnpm's clean-install command, not this repo's CI.
- Root checks: `make lint`, `make test`, `make build`; `make ci` also runs schema, Helm, and security checks.
- `make build` and CI build API, Gateway, Worker, CLI, Web, plus `k8s`, `runtime-adapter`, `github`, `gitlab`, and `internal-docs` MCP server targets; `pnpm dev` starts only the k8s server locally.
- Focused Go checks: `go test ./internal/<pkg>`, `go test ./apps/... ./tests/...`, or `go test ./tests/e2e ./tests/security`.
- Focused Web checks: `pnpm --filter @mcp-hub/web test`, `typecheck`, `lint`, or `build`; use `@mcp-hub/ui` for the shared UI package.
- `pnpm typecheck` runs UI then Web typechecks; `scripts/ci/web.sh` runs lint, typecheck, test, build for both workspaces.
- `pnpm dev:smoke-test` expects the local stack and Compose infra to be running. Go tests under `tests/contract`, `tests/e2e`, `tests/load`, and `tests/migration` are offline `httptest`/in-memory suites.
- `pnpm helm:template` requires both `helm` and `kustomize`; `bash tests/helm-template.sh` renders default/dev/stg/prod Helm values plus GitOps overlays. `scripts/ci/helm.sh` may skip locally if `helm` is missing.
- Avoid `pnpm format` or `make fmt` unless requested: they format the whole repo.

## Contracts and generated files

- `schemas/` is the language-neutral source of truth. Update schemas before runtime/Web consumers when behavior crosses API, policy, manifest, audit, grant, or client-profile boundaries.
- OpenAPI source is `schemas/openapi/mcp-hub.openapi.yaml`; the runtime OpenAPI document is emitted from `internal/controlplane/server.go`; generated artifacts are `schemas/openapi/control-plane.openapi.json` and `apps/web/lib/generated/mcp-hub-client.ts`.
- Do not edit `apps/web/lib/generated/mcp-hub-client.ts` by hand. Run `make gen-openapi`, then `scripts/gen/openapi.sh --check`.
- JSON schemas under `schemas/jsonschema/` and `schemas/catalog/mcp-server-manifest.schema.json` are hand-authored. Run `make gen-schemas` and `scripts/gen/schemas.sh --check` after edits.
- First-party MCP manifests live at `servers/*/mcp-server.manifest.json`; validate with `pnpm security:mcp-manifests` or pass explicit manifest paths after `--`.
- Application Web code should import the generated client boundary instead of duplicating Control Plane paths or the `{ error, traceId }` envelope.

## Runtime state and local auth

- Service entrypoints use `internal/db.NewRuntimeStore()` with shared local JSON persistence, not automatic PostgreSQL migrations; tests often use in-memory `internal/db.NewSeedStore()`.
- Default `MCP_STORE_PATH` is `<os temp dir>/mcp-hub/store.json` (usually `/tmp/mcp-hub/store.json`); set `MCP_STORE_MODE=memory` to bypass persistence.
- API, Gateway, and Worker share local state through `MCP_STORE_PATH`; reset local runtime state with `pnpm dev:reset-db` or remove that file.
- Seed data is code-backed in `internal/db.NewSeedStore` and mirrored in `tests/fixtures/local-seed.json`; keep them aligned when seed users, grants, servers, or client profiles change.
- Local mock tokens are `dev-admin-token` and `dev-readonly-token`. Keep fixture/docs examples limited to these mock values.
- In `MCP_AUTH_MODE=oidc`, mock Gateway tokens are rejected unless `MCP_ALLOW_MOCK_TOKENS=true`; Control Plane trusted identity headers require `MCP_TRUSTED_AUTH_HEADERS=true` or the configured trusted proxy token/header.
- Web browser auth is separate from Gateway MCP bearer auth; non-production Web enables the `dev` provider by default, and server-side Web requests forward signed-session identity through trusted headers only when the API trusts them.
- Worker `POST /jobs/run` requires a platform-admin bearer token or `MCP_WORKER_JOB_TOKEN`, and the body must be one JSON job array.

## MCP Hub security constraints

- Treat MCP servers, tool/resource/prompt metadata, upstream URLs, and manifests as untrusted input.
- Gateway policy/auth/redaction/SSRF checks must happen before upstream calls; do not move authorization into the UI only.
- Generated client configs must route through Gateway `/mcp/{serverSlug}` with bearer auth so clients do not bypass policy, rate limiting, redaction, or audit.
- Server mutations, approvals, emergency controls, runtime status, and secret lease APIs require platform-admin context and audit-worthy behavior.
- Manifests may reference secrets only by external refs; never commit raw secret/token/password/client-secret values in manifests, docs, tests, logs, or Helm values.
- High or critical tool changes need explicit policy/grant review; prompt-injection-like tool metadata is quarantined from discovery.

## Manual QA surfaces

- CLI: `go run ./apps/cli/cmd/mcphubctl --help`, `version`, or `--api-url http://localhost:4000 health`.
- API: run `go run ./apps/api/cmd/api`, then `curl http://localhost:4000/healthz` and a focused `/api/*` route.
- Gateway: run the stack, then call `/mcp/k8s-readonly` with `Authorization: Bearer dev-admin-token` and a `tools/list` JSON-RPC body.
- Web: run API plus `pnpm --filter @mcp-hub/web dev`; protected user routes are under `/user/*`, admin routes under `/admin/*`, and legacy flat routes only redirect.
- Worker: run `go run ./apps/worker/cmd/worker`, then trigger `/jobs/run` with an authorized JSON array.
