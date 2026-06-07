# Lane E - Go Observability/Audit/Analytics Handoff

## Changed Files

- `internal/telemetry/telemetry.go`
- `internal/auth/auth.go`
- `internal/logger/logger.go`
- `internal/audit/audit.go`
- `internal/db/types.go`
- `internal/db/store.go`
- `internal/controlplane/server.go`
- `internal/gateway/server.go`
- `internal/worker/server.go`
- `internal/jobs/jobs.go`
- `apps/web/lib/api.ts`
- `apps/web/components/tables.tsx`
- `apps/web/app/operations/page.tsx`
- `schemas/openapi/mcp-hub.openapi.yaml`
- `schemas/openapi/control-plane.openapi.json`
- `deploy/helm/mcp-hub/templates/service-worker.yaml`
- `deploy/helm/mcp-hub/templates/servicemonitor.yaml`
- `deploy/helm/mcp-hub/templates/prometheusrule.yaml`
- `deploy/helm/mcp-hub/templates/grafana-dashboard-configmap.yaml`
- `deploy/helm/mcp-hub/values*.yaml`
- `deploy/gitops/overlays/*/kustomization.yaml`
- `docs/AUDIT_OBSERVABILITY.md`
- `docs/RUNBOOK.md`
- `docs/RUNBOOKS.md`
- `tests/helm-template.sh`
- Go tests under `internal/db`, `internal/controlplane`, `internal/gateway`, and `internal/jobs`

## Contract and Schema Changes

- Added Control Plane analytics routes: `GET /api/analytics/usage`, `GET /api/analytics/usage/export`, and `GET /api/analytics/denied-calls`.
- Analytics routes are admin-only and documented with `x-platform-admin-required` in the OpenAPI sources and runtime document.
- In `MCP_AUTH_MODE=oidc`, API identity headers require the configured trusted-proxy shared secret before platform-admin analytics checks can pass.
- File-backed request cycles now serialize refresh/mutate/save to avoid local lost updates in audit, analytics, and health records.
- Added `traceId`, `attempt`, and `backoffSeconds` fields to server health responses.
- Updated OpenAPI YAML/JSON runtime contract sources.

## DB Migration

- No migration added. Runtime remains the existing in-memory/file-backed JSON store. Aggregations are computed from `AuditEvent` records.

## Verification

- `go test ./...`
- `pnpm --filter @mcp-hub/web test`
- `pnpm typecheck`
- `scripts/ci/schemas.sh`
- `pnpm helm:template`
- `make lint`
- `make test`
- `make build`
- Prettier check for changed non-Go files
- Manual live HTTP QA: API analytics/usage/metrics/error path, Gateway tools/list/auth failure/metrics, Worker job run/metrics

## Remaining TODO

- No Lane E TODO remains in this worktree.
- Durable Postgres/SIEM audit persistence remains a future architecture decision outside this in-memory Go-core skeleton.

## Cross-Lane Notes

- Lane C should consume the new analytics routes if regenerating or expanding the Web client.
- Lane B should account for the analytics routes and new server-health fields if it replaces the runtime store with durable DB APIs.
- Lane G should keep the Helm/schema checks that now assert observability resources.
