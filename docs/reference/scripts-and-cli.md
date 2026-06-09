# Scripts and CLI

이 문서는 MCP Hub 저장소의 root scripts, Makefile targets, helper scripts, `mcphubctl`, docs commands를 확인하는 개발자와 운영자를 위한 참고 문서다.

## `package.json` scripts

| Script | Command | 용도 |
| --- | --- | --- |
| `dev` | `make dev` | Go core와 Web local stack 실행 wrapper |
| `dev:infra` | `scripts/dev/up-infra.sh` | Compose support services 시작 |
| `dev:infra:down` | `scripts/dev/down-infra.sh` | Compose support services 중지 |
| `db:migrate` | `scripts/dev/db-migrate.sh` | local migration helper |
| `db:seed` | `scripts/dev/seed.sh` | seed helper |
| `dev:reset-db` | `scripts/dev/reset-db.sh` | local runtime state reset |
| `dev:seed` | `scripts/dev/seed.sh` | seed source 출력/확인 helper |
| `dev:smoke-test` | `scripts/dev/smoke-test.sh` | 실행 중인 local stack smoke test |
| `dev:create-mock-token` | `scripts/dev/create-mock-token.sh` | local mock token 생성 helper |
| `build` | `make build` | Go apps/servers와 Web packages build |
| `lint` | `make lint` | gofmt/go vet/pnpm lint |
| `test` | `make test` | Go tests와 pnpm tests |
| `typecheck` | UI then Web typecheck | TypeScript workspace typecheck |
| `format` | `prettier --write .` | repo-wide format, 요청 없이는 주의해서 사용 |
| `security:deps` | `scripts/security/scan-deps.sh` | dependency scan helper |
| `security:supply-chain` | `scripts/security/scan-supply-chain.sh` | supply-chain scan helper |
| `security:images` | `scripts/security/scan-images.sh` | container image scan helper |
| `security:sbom` | `scripts/security/sbom-sign-images.sh` | SBOM/signing evidence helper |
| `security:secrets` | `scripts/security/scan-secrets.sh` | secret scan helper |
| `security:k8s` | `scripts/security/scan-k8s-manifests.sh` | Kubernetes manifest scan helper |
| `security:mcp-manifests` | `go run ./scripts/security/check-mcp-manifest.go` | first-party MCP manifest validation |
| `security:check` | `scripts/security/check-all.sh` | aggregate security checks |
| `ci` | `make ci` | aggregate CI-equivalent local command |
| `test:unit` | Go internal tests and UI/Web unit tests | focused unit validation |
| `test:integration` | `go test ./apps/... ./tests/...` | app/integration suites |
| `test:e2e` | `go test ./tests/e2e ./tests/security` | e2e and security negative suites |
| `helm:template` | `bash tests/helm-template.sh` | Helm/GitOps rendering validation |
| `security:smoke` | `pnpm security:mcp-manifests` | security smoke validation |
| `release:notes` | `bash scripts/release/generate-notes.sh` | release notes helper |
| `docs:sync` | `uv sync --group docs` | docs dependency group sync |
| `docs:serve` | `uv run --group docs mkdocs serve` | local docs preview |
| `docs:build` | `uv run --group docs mkdocs build --strict` | strict docs build |
| `docs:check` | `uv run --group docs mkdocs build --strict` | CI-equivalent docs check |

## `Makefile` targets

| Target | 용도 |
| --- | --- |
| `dev` | `./scripts/dev/run-go-core.sh` |
| `build` | API, Gateway, Worker, CLI, first-party servers, Web packages build |
| `lint` | gofmt check, `go vet`, pnpm lint |
| `test` | `go test ./...`, pnpm tests |
| `ci` | Go, Web, schema, Helm, security aggregate scripts |
| `fmt` | gofmt write와 repo-wide pnpm format |
| `gen-openapi` | OpenAPI generated artifacts update/check helper |
| `gen-schemas` | JSON schema generated artifacts helper |
| `schema` | OpenAPI and schema generation aggregate |
| `demo-check` | focused demo validation |
| `security` | aggregate security checks |
| `release-notes` | release notes generation |
| `docs-sync` | `uv sync --group docs` |
| `docs-serve` | `uv run --group docs mkdocs serve` |
| `docs-build` | `uv run --group docs mkdocs build --strict` |
| `docs-check` | docs strict build wrapper |

## `scripts/dev`

| Script | 용도 |
| --- | --- |
| `scripts/dev/up-infra.sh` | Compose support services 시작 |
| `scripts/dev/down-infra.sh` | Compose support services 중지 |
| `scripts/dev/run-go-core.sh` | local Go core plus Web 실행 |
| `scripts/dev/smoke-test.sh` | live local smoke test |
| `scripts/dev/reset-db.sh` | local runtime state reset |
| `scripts/dev/seed.sh` | seed source 확인 |
| `scripts/dev/create-mock-token.sh` | local mock token 생성 |
| `scripts/dev/db-migrate.sh` | local DB migration helper |
| `scripts/dev/keycloak-realm.json` | local Keycloak realm import |
| `scripts/dev/otel-collector-config.yaml` | optional OTel collector config |

## `scripts/ci`

| Script | 용도 |
| --- | --- |
| `scripts/ci/go.sh` | Go fmt/vet/test/build lane |
| `scripts/ci/web.sh` | Web/UI lint/typecheck/test/build lane |
| `scripts/ci/schemas.sh` | OpenAPI/JSON Schema/MCP manifest drift lane |
| `scripts/ci/helm.sh` | Helm/GitOps render lane |

## `scripts/security`

| Script | 용도 |
| --- | --- |
| `scripts/security/check-all.sh` | aggregate security checks |
| `scripts/security/check-mcp-manifest.go` | MCP manifest validation |
| `scripts/security/scan-deps.sh` | dependency scan |
| `scripts/security/scan-supply-chain.sh` | supply-chain scan |
| `scripts/security/scan-images.sh` | image scan |
| `scripts/security/sbom-sign-images.sh` | SBOM/signing evidence |
| `scripts/security/scan-secrets.sh` | secret scan |
| `scripts/security/scan-k8s-manifests.sh` | Kubernetes manifest scan |

## Release script

```bash
bash scripts/release/generate-notes.sh
make release-notes VERSION=<version>
pnpm release:notes
```

## `mcphubctl` examples

```bash
go run ./apps/cli/cmd/mcphubctl --help
go run ./apps/cli/cmd/mcphubctl version
go run ./apps/cli/cmd/mcphubctl --api-url http://localhost:4000 health
go run ./apps/cli/cmd/mcphubctl --api-url http://localhost:4000 client config --client opencode --output json
go run ./apps/cli/cmd/mcphubctl --api-url http://localhost:4000 --output json audit export --from 2026-06-07T00:00:00Z --to 2026-06-08T00:00:00Z --signed
```

`mcphubctl`은 Control Plane API를 호출한다. DB, Kubernetes, secret store를 직접 mutate하지 않는다.

## Docs commands

=== "Install"

    ```bash
    uv sync --group docs
    ```

=== "Local preview"

    ```bash
    uv run --group docs mkdocs serve
    ```

=== "CI check"

    ```bash
    uv run --group docs mkdocs build --strict
    ```

CI에서는 lockfile 기반으로 실행한다.

```bash
uv sync --locked --group docs
uv run --group docs mkdocs build --strict
```
