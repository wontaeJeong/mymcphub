# CI

MCP Hub CI is secretless and uses only deterministic repository-local validation. It does not run network-dependent external scanners.

## Local Commands

Run the same validation layers locally from the repository root:

```sh
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm build
pnpm security:smoke
pnpm helm:template
pnpm run ci
```

`pnpm test:unit` runs unit suites in shared packages, first-party MCP servers, `apps/stdio-adapter`, and the API audit helper tests. `pnpm test:integration` runs API, Gateway, Worker, and DB repository contract suites. DB integration tests use deterministic repository query fixtures and verify that `TEST_DATABASE_URL` never falls back to or equals `DATABASE_URL`, keeping test and application database configuration separate. `pnpm test:e2e` runs the cross-workspace smoke suite in `@mcp-hub/tests`, which starts the echo MCP server and Gateway in-process, authenticates with `Bearer dev-admin-token`, verifies `tools/list`, allows `echo_message`, denies ungranted and unknown tools, and checks audit events.

`pnpm helm:template` validates the real chart at `deploy/helm/mcp-hub` with release name `mcp-hub`. It runs `helm lint`, renders the default, dev, staging, and production values, and asserts that the API, Gateway, and Worker resources are present in each output.

## GitHub Actions Jobs

The workflow in `.github/workflows/ci.yaml` has these jobs:

- `install`: checks out the repository, installs pnpm `10.12.1`, configures Node.js `22` with pnpm cache, and runs `pnpm install --frozen-lockfile`.
- `lint`: runs `pnpm lint`.
- `typecheck`: runs `pnpm typecheck`.
- `test`: runs `pnpm test:unit`, `pnpm test:integration`, and `pnpm test:e2e`.
- `build`: runs `pnpm build`.
- `security-smoke`: runs `pnpm security:smoke`, currently the deterministic MCP manifest policy check.
- `helm-template`: installs Helm with `azure/setup-helm@v5.0.0` and runs `pnpm helm:template`.

Use `pnpm run ci` for the aggregate root script; pnpm `10.12.1` treats bare `pnpm ci` as the clean-install command. The aggregate script runs full-repository lint, typecheck, test, build, security smoke, and Helm template validation.
