# Lane A - Go Gateway/Auth/Policy Handoff

## Changed Files

- `internal/gateway/server.go`, `internal/gateway/server_test.go`
- `internal/auth/auth.go`, `internal/auth/auth_test.go`
- `internal/db/types.go`, `internal/db/store.go`, `internal/db/store_test.go`
- `internal/policy/policy.go` behavior consumed by gateway without signature changes
- `internal/ratelimit/ratelimit.go`, `internal/ratelimit/ratelimit_test.go`
- `internal/config/config.go`
- `internal/mcp/jsonrpc.go`
- `internal/controlplane/server.go`, `internal/controlplane/server_test.go`
- `internal/worker/server.go`
- `internal/cli/cli.go`, `internal/cli/cli_test.go`
- `schemas/jsonschema/client-profile.schema.json`
- `schemas/policy/policy-decision.schema.json`
- `.env.example`, `apps/gateway/README.md`, `docs/GATEWAY.md`, `docs/POLICY.md`, `docs/CLIENT_SETUP.md`, `docs/SECURITY.md`, `docs/IMPLEMENTATION_NOTES.md`, `docs/API_IMPLEMENTATION_NOTES.md`, `docs/RUNBOOK.md`

## Contract / Schema Changes

- Client profile schema now documents `serverSlug` and bearer `auth` metadata.
- Policy decision schema now documents `reasonCode`, `matchedGrantIds`, `requiresApproval`, `requiresStepUp`, and `discoverableToolNames`.
- API client-config generation now emits Gateway URLs and bearer header placeholders instead of catalog upstream URLs.
- Local runtime store now persists seeded OAuth clients and enforces Gateway client registration unless `MCP_ALLOW_DYNAMIC_CLIENTS=true`.
- Store persistence now uses an inter-process file lock and audit append merge path so Gateway audit writes do not clobber newer catalog/grant changes.
- Runtime-store-backed quota buckets now enforce rate limits across Gateway MCP routes and Control Plane API routes; full-store saves merge latest audit/quota state and quota increments prune expired buckets.
- MCP server schema accepts `timeoutMs` for per-server upstream timeout overrides.

## DB Migration

- None. `OAuthClient` and rate-limit buckets are part of the local JSON runtime store for this skeleton; no SQL migration was added.

## Verification

- `go test ./...` passed.
- Go binary build passed for API, Gateway, Worker, CLI, and k8s server.
- `bash scripts/ci/schemas.sh` passed.
- `bash scripts/ci/helm.sh` passed.
- `pnpm --filter @mcp-hub/web test` passed after installing workspace dependencies with `pnpm install --frozen-lockfile`.
- Manual live Gateway HTTP QA passed for `/healthz`, unauthenticated `401` with `WWW-Authenticate`, OIDC `CLIENT_NOT_REGISTERED`, registered OIDC `tools/list`, and rate-limit `429`/`RATE_LIMITED`.
- Post-review remediation added tests for store-backed API/Gateway quotas, stale-save quota/audit merge, expired bucket pruning, canonical unknown API route quota keys, rate-limited initialize session non-allocation, strict route slash rejection, missing JWT client identity, project-scoped grants/sessions, safe local fallback output, proxy-disabled upstream transport, and per-server timeout context.

## Remaining TODO

- None for Lane A scope.

## Cross-Lane Notes

- Lane C should consume the changed client-config response shape from schema/OpenAPI generation.
- Lane E may extend the new Gateway metrics names for dashboards.
- Lane B should avoid reverting Gateway URL behavior in client-config generation.
