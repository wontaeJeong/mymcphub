# Testing

Run all local validation with:

```sh
make test
make lint
make build
```

Coverage includes:

- Go unit tests for API, Gateway, Worker jobs, and CLI.
- Go contract tests in `tests/contract` for OpenAPI examples, response envelopes, and generated Web client boundaries.
- Go e2e tests in `tests/e2e`.
- Go load/soak tests in `tests/load` for Gateway concurrency, latency, memory budget, and cancellation behavior.
- Go migration/upgrade tests in `tests/migration` for migration ordering, idempotency, seed compatibility, and persisted seed reloads.
- Go security negatives in `tests/security` for unauthenticated deny, unauthorized discovery filtering, unauthorized call denial, redaction, and SSRF-like upstream blocking.
- MCP attack-suite negatives for command-injection-shaped inputs, path traversal, secret leakage, DLP blocks, unauthorized tools, and prompt-injection metadata quarantine.
- Web UI tests through pnpm workspace commands, including internal MCP Market catalog filters, category/tag parsing, optional metadata fallback, access request prefill, client-config preselect, approval decision context, and newest health selector ordering.
- Schema drift checks through `scripts/ci/schemas.sh`.
- Helm rendering through `scripts/ci/helm-template.sh`.

Focused Lane G commands:

```sh
go test ./tests/contract ./tests/e2e ./tests/load ./tests/migration
pnpm --filter @mcp-hub/web test -- shared-fixtures
```

Focused internal MCP Market checks:

```sh
pnpm --filter @mcp-hub/web test:unit -- lane-f-tests-docs-demo
pnpm --filter @mcp-hub/web typecheck
pnpm dev:smoke-test
```

`pnpm dev:smoke-test` is a live-stack check. It does not start Next.js; it verifies Control Plane/Gateway behavior that backs the Web market flow: seeded market metadata on `/api/servers`, unchanged `/api/server-health`, Gateway tool discovery/calls, and `/api/client-config/generate` output that routes through Gateway bearer auth.
