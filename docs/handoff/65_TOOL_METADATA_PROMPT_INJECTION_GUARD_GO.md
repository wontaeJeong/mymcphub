# 65. TOOL_METADATA_PROMPT_INJECTION_GUARD_GO Handoff

## Changed Files

- `internal/security/metadata_guard.go`
- `internal/security/metadata_guard_test.go`
- `internal/gateway/server.go`
- `internal/jobs/jobs.go`
- `internal/jobs/jobs_test.go`
- `tests/security/mcp_attack_security_test.go`
- `docs/SECURITY.md`
- `docs/WORKER.md`

## Contract/Schema Changes

- None.

## DB Migration

- None.

## Tests And Verification

- `GOTOOLCHAIN=go1.26.4 go test ./internal/security ./internal/gateway ./internal/jobs ./tests/security`
- Included in `GOTOOLCHAIN=go1.26.4 go test ./...`.

## Remaining TODO

- Worker records quarantine recommendations; a future API can persist quarantine state if needed.

## Conflict Notes

- Gateway hides risky tool metadata from discovery and denies call attempts before upstream execution.
