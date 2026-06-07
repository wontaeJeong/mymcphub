# Lane G Handoff - DX/Tests/Release/Compatibility

## Changed Files

- Added shared fixtures and Go test utilities under `tests/fixtures` and `internal/testutil`.
- Added Go suites under `tests/contract`, `tests/e2e`, `tests/load`, `tests/migration`, plus `internal/mcp/jsonrpc_test.go`.
- Added Web fixture assertion at `apps/web/test/shared-fixtures.test.ts`.
- Added release-note generator at `scripts/release/generate-notes.sh`, `pnpm release:notes`, and `make release-notes`.
- Added developer, client compatibility, and worktree merge docs under `docs/`.
- Updated CI matrix, CLI defaults/docs, local dev docs, release docs, testing docs, and OpenAPI examples.

## Contract/Schema Changes

- Non-breaking OpenAPI example metadata was added for `POST /api/client-config/generate` in `schemas/openapi/mcp-hub.openapi.yaml`.
- No JSON Schema changes.
- No generated Web client shape changes.

## DB Migration 여부

- No new DB migration.
- Added migration tests that verify migration ordering, idempotency guards, non-destructive SQL, seed-compatible tables, and persisted seed reload compatibility.

## Test Results

- `go test ./...` passed.
- `make test` passed.
- `make build` passed.
- `make lint` passed.
- `make ci` passed.
- `scripts/ci/schemas.sh` passed.
- `bash tests/helm-template.sh` passed.
- `pnpm --filter @mcp-hub/web test` passed after installing locked pnpm dependencies.
- `bash -n scripts/release/generate-notes.sh scripts/dev/seed.sh scripts/dev/reset-db.sh` passed.
- Manual tmux QA passed for `mcphubctl --help`, `mcphubctl version`, bad CLI input, and `pnpm release:notes -- --version ...` Markdown rendering.

## Remaining TODO

- None for Lane G skeleton scope.
- Claude Code, Codex, and VS Code client snippets remain explicit placeholders until exact installed-client remote MCP formats are confirmed.

## Conflict Risks

- `schemas/openapi/mcp-hub.openapi.yaml` may conflict with Lane B contract edits.
- `README.md`, `docs/CI.md`, `docs/TESTING.md`, and `.github/workflows/ci.yaml` may conflict with other documentation or CI lanes.
- `internal/cli/cli.go` default server ID fix may conflict with CLI feature work.
