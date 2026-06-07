# Worktree Merge Guide

Use this guide when merging the Go core parallel lanes back together.

## Merge Order

1. Merge shared contracts first: OpenAPI, JSON Schema, DB migrations, and generated Web client boundaries.
2. Merge Go runtime lanes next: Gateway/Auth/Policy, API/DB, Runtime/Servers, Observability/Audit.
3. Merge Web UI after the API contract it consumes is present.
4. Merge security/supply-chain checks after the runtime and schema surfaces they scan are stable.
5. Merge Lane G last or near-last so tests, release notes, compatibility docs, and handoff files reflect the combined shape.

## Contract Changes First

- A lane that changes `schemas/` must include the generated or runtime alignment change in the same PR.
- Run `scripts/ci/schemas.sh` before merging another lane on top.
- If two lanes change the same endpoint or schema, resolve the contract shape before resolving implementation details.

## Migration Conflicts

- Keep migration filenames zero-padded and monotonic.
- Do not renumber a migration that another lane already referenced in handoff.
- Prefer a new migration over editing a migration that has already been reviewed by another lane.
- Re-run `go test ./tests/migration` after conflict resolution.

## Test Checklist

Run these after the final merge conflict is resolved:

```sh
go test ./...
pnpm --filter @mcp-hub/web test
scripts/ci/schemas.sh
bash tests/helm-template.sh
```

Also run the release-note generator for the merged candidate:

```sh
pnpm release:notes -- --version <candidate> --schema-changes "contract and migration summary"
```

## Handoff Requirements

Every lane handoff should state:

- changed files
- contract/schema changes
- DB migration additions
- tests run and results
- TODOs or known gaps
- lane conflict risks
