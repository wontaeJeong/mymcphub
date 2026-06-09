# Operations

이 문서는 MCP Hub를 로컬 개발 환경에서 운영하거나 Helm/GitOps 기반 환경으로 배포/검증하는 운영자를 위한 관문이다.

## Local/dev 운영과 Helm/GitOps 운영

| 구분 | Local/dev | Helm/GitOps |
| --- | --- | --- |
| 목적 | 개발, 데모, contract/smoke 확인 | shared environment 배포와 운영 |
| 시작 | `pnpm dev:infra`, `pnpm dev` | Helm chart와 GitOps overlays |
| 상태 저장 | `MCP_STORE_PATH` local JSON 또는 memory skeleton | 문서화된 운영 방향과 chart values 기준 |
| 인증 | non-production dev provider, mock token 사용 가능 | OIDC/trusted headers/secret manager 기준 구성 필요 |
| 검증 | `make demo-check`, `pnpm dev:smoke-test` | `pnpm helm:template`, CI, release/rollback runbook |

## Compose support services

`compose.yaml`은 로컬 support services를 제공한다.

| Service | Port | 용도 |
| --- | --- | --- |
| Postgres | `127.0.0.1:5432` | 로컬 infra dependency placeholder |
| Redis | `127.0.0.1:6379` | 로컬 cache/queue dependency placeholder |
| Keycloak | `127.0.0.1:8080` | 로컬 OIDC issuer demo |
| `otel-collector` | `127.0.0.1:4317`, `127.0.0.1:4318` | optional `otel` profile collector |

```bash
pnpm dev:infra
pnpm dev:infra:down
```

## 운영 문서 맵

| 문서 | 용도 |
| --- | --- |
| [Operations](../OPERATIONS.md) | Day-2 operating model |
| [Deployment](../DEPLOYMENT.md) | Helm/GitOps deployment |
| [Runbooks](../RUNBOOKS.md) | common incident quick triage |
| [Detailed Runbook](../RUNBOOK.md) | detailed procedures |
| [Rollback](../ROLLBACK.md) | previous Go image tag rollback |
| [CI](../CI.md) | GitHub Actions jobs와 local equivalent commands |
| [Security](../SECURITY.md) | security model and scan expectations |
| [Policy](../POLICY.md) | authorization policy model |
| [Audit Observability](../AUDIT_OBSERVABILITY.md) | audit, metrics, observability skeleton and limits |

## 운영 주의

!!! warning "로컬 전용 인증"
    `dev-admin-token`, `dev-readonly-token`, mock auth, Web dev provider는 운영용이 아니다. 운영 환경에서는 OIDC, trusted proxy headers, secret manager, Gateway bearer auth를 환경에 맞게 구성한다.

!!! warning "Secret handling"
    secret values는 manifest, docs, logs, UI, Helm values에 노출하지 않는다. MCP manifests는 external ref만 사용하고, runtime secret lease metadata도 raw credential을 반환하지 않는다.

!!! note "Corporate proxy/CA"
    corporate proxy와 private CA는 local build/development placeholder로 관리한다. private certificate material은 승인 없이 repository에 커밋하지 않는다.

## 자주 쓰는 운영 검증

```bash
make lint
make test
make build
make ci
make demo-check
pnpm dev:smoke-test
pnpm helm:template
```
