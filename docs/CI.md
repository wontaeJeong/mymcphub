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

`pnpm test:unit` runs Go unit suites and Web UI unit checks. `pnpm test:integration` runs API, Gateway, Worker, and repository contract suites. `pnpm test:e2e` runs Go e2e and security suites, authenticates with `Bearer dev-admin-token`, verifies `tools/list`, allows granted tools, denies ungranted and unknown tools, and checks audit behavior.

`pnpm helm:template` validates the real chart at `deploy/helm/mcp-hub` with release name `mcp-hub`. It runs `helm lint`, renders the default, dev, staging, and production values, and asserts that the API, Gateway, and Worker resources are present in each output.

## GitHub Actions Jobs

The workflow in `.github/workflows/ci.yaml` has these jobs:

- `go-core`: runs Go fmt, vet, tests, and builds.
- `web-ui`: installs pnpm dependencies and runs Web UI lint, typecheck, tests, and build.
- `schemas`: runs OpenAPI, JSON Schema, and MCP manifest drift checks.
- `helm-gitops`: renders Helm and GitOps overlays.
- `e2e-security`: runs Go e2e and security negative tests.
- `docker-build`: builds API, Gateway, Worker, CLI, Web, and k8s images.

Use `pnpm run ci` for the aggregate root script; pnpm `10.12.1` treats bare `pnpm ci` as the clean-install command. The aggregate script runs full-repository lint, typecheck, test, build, security smoke, and Helm template validation.

The OpenAPI check compares `schemas/openapi/mcp-hub.openapi.yaml`, runtime `/openapi.json` from `internal/controlplane`, generated `schemas/openapi/control-plane.openapi.json`, and the generated Web path list in `apps/web/lib/generated/mcp-hub-client.ts`.
