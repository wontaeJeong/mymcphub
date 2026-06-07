# 69. COMPLIANCE_EXPORT_GO Handoff

## Changed Files

- `internal/audit/export.go`
- `internal/controlplane/server.go`
- `internal/controlplane/server_test.go`
- `internal/db/store.go`
- `internal/jobs/jobs.go`
- `internal/jobs/jobs_test.go`
- `internal/cli/cli.go`
- `internal/cli/cli_test.go`
- `schemas/openapi/mcp-hub.openapi.yaml`
- `docs/API.md`
- `docs/AUDIT_OBSERVABILITY.md`
- `docs/CLI.md`
- `docs/WORKER.md`

## Contract/Schema Changes

- `/api/audit-events/export` now requires `from` and `to`, enforces platform-admin access, always redacts, and optionally signs with `MCP_COMPLIANCE_EXPORT_SIGNING_KEY`.
- OpenAPI export route documents filters, `redacted`, `signed`, and 403 behavior.

## DB Migration

- None.

## Tests And Verification

- `GOTOOLCHAIN=go1.26.4 go test ./internal/controlplane ./internal/jobs ./internal/cli`
- Included in `GOTOOLCHAIN=go1.26.4 go test ./...`.
- Manual API/CLI export QA performed against a live local API process.

## Remaining TODO

- Durable export storage and external key management are not implemented in this skeleton.

## Conflict Notes

- Worker `audit-export` returns export metadata and records `audit.export.completed`; API export records `audit.export.generated`.
