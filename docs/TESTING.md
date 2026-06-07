# Testing

Run all local validation with:

```sh
make test
make lint
make build
```

Coverage includes:

- Go unit tests for API, Gateway, Worker jobs, and CLI.
- Go e2e tests in `tests/e2e`.
- Go security negatives in `tests/security` for unauthenticated deny, unauthorized discovery filtering, unauthorized call denial, redaction, and SSRF-like upstream blocking.
- MCP attack-suite negatives for command-injection-shaped inputs, path traversal, secret leakage, DLP blocks, unauthorized tools, and prompt-injection metadata quarantine.
- Web UI tests through pnpm workspace commands.
- Schema drift checks through `scripts/ci/schemas.sh`.
- Helm rendering through `tests/helm-template.sh`.
