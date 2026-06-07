# Developer Guide

This guide is the Lane G entry point for contributors working on the Go core MCP Hub.

## Architecture Boundaries

- Go owns `apps/api`, `apps/gateway`, `apps/worker`, `apps/cli`, `internal/*`, and first-party Go MCP servers.
- TypeScript owns only `apps/web` and packages consumed by the Web UI.
- `schemas/` remains the language-neutral contract source. Runtime behavior must stay aligned with OpenAPI, JSON Schema, and generated Web client boundaries.
- Operational actions must go through the Control Plane API, Gateway, Web UI, or `mcphubctl`; scripts are local, CI, generation, or release helpers only.

## Local Development

Start from the repository root:

```sh
pnpm install
cp .env.example .env
pnpm dev:infra
pnpm dev
```

The local Go store is seeded from `internal/db.NewSeedStore` and mirrored for tests in `tests/fixtures/local-seed.json`. The seeded catalog includes the `k8s-readonly` MCP server, platform team/project IDs, mock admin and readonly users, and a dev grant for `list_namespaces`, `list_pods`, and `get_pod`.

## Testing

Use the fastest focused command for the surface you changed, then run the aggregate checks before handoff:

```sh
go test ./...
pnpm --filter @mcp-hub/web test
scripts/ci/schemas.sh
bash tests/helm-template.sh
```

Lane G adds offline suites under `tests/contract`, `tests/e2e`, `tests/load`, and `tests/migration`. These use `httptest`, shared fixtures, and the in-memory store, so they do not require Docker Compose or a running API/Gateway.

## Coding Conventions

- Keep Go tests deterministic and in-process unless a prompt explicitly requires running infrastructure.
- Prefer handwritten, explicit request/response structs at API boundaries.
- Keep fixture data free of secrets. Local mock tokens are `dev-admin-token` and `dev-readonly-token` only.
- Do not add `apps/*-go` suffix paths.
- Do not add direct DB, Kubernetes, or secret-store mutation scripts.
- Document shared contract or migration changes in the relevant handoff file.

## Manual QA Surfaces

- CLI: run `go run ./apps/cli/cmd/mcphubctl --help` and a focused command such as `version` or `health`.
- API/Gateway: use `httptest` for tests and `curl` against a live process for local smoke checks.
- Web: use `pnpm --filter @mcp-hub/web test` for fixture/client boundaries and browser QA for UI changes.
- Release notes: run `pnpm release:notes -- --version <version>` and inspect the rendered Markdown.
