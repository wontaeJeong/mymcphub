# 77 SDK_EXAMPLES_GO_TS Handoff

## Changed Files

- `docs/CLIENT_SETUP.md`
- `docs/CLI.md`
- `apps/cli/README.md`
- `internal/cli/cli.go`
- `internal/cli/cli_test.go`
- `docs/MCP_CLIENT_COMPATIBILITY.md`

## Contract/Schema Changes

- No schema shape change.
- CLI default client-config server ID now uses the actual seeded `db.K8sReadonlyID`.

## DB Migration 여부

- No migration added.

## Test Results

- `go test ./internal/cli` passed as part of `go test ./...`.
- Manual tmux QA passed for CLI help, version, and bad input.

## Remaining TODO

- Exact Claude Code, Codex, and VS Code config formats remain placeholders until client-version-specific docs are confirmed.

## Conflict Risks

- CLI command changes in another lane may require reconciling docs and default client-config behavior.
