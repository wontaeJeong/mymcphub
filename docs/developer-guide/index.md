# Developer Guide

이 문서는 MCP Hub 저장소에서 Go core, Next.js Web, schemas, tests, deployment assets를 개발하려는 개발자를 위한 관문이다.

새 동작을 추가할 때는 실행 가능한 설정과 계약을 우선한다. `Makefile`, `package.json`, `.github/workflows/ci.yaml`, `scripts/ci/*`, `schemas/`가 현재 검증과 계약의 기준이다.

## Repo 구조 요약

| 경로 | 역할 |
| --- | --- |
| `apps/api` | Go Control Plane API |
| `apps/gateway` | Go MCP Gateway Data Plane |
| `apps/worker` | Go background worker |
| `apps/cli` | Go `mcphubctl` operator CLI |
| `apps/web` | TypeScript / Next.js Web console |
| `packages/ui` | shared TypeScript UI package |
| `servers/k8s` | Go read-only Kubernetes MCP server |
| `servers/runtime-adapter` | Go stdio subprocess adapter MCP server |
| `servers/github` | Go read-only GitHub MCP server |
| `servers/gitlab` | Go read-only GitLab MCP server |
| `servers/internal-docs` | Go read-only internal docs MCP server |
| `internal` | Go shared auth, audit, config, db, policy, MCP, redaction, telemetry packages |
| `schemas` | OpenAPI / JSON Schema source of truth |
| `deploy` | Helm chart and GitOps overlays |
| `scripts` | dev, ci, gen, release, security helper scripts |
| `tests` | Go e2e/security/contract/load/migration tests and TypeScript contract smoke tests |

## Runtime planes

| Plane | 시작점 | 설명 |
| --- | --- | --- |
| Control Plane | `apps/api/cmd/api` | catalog, grants, approvals, audit, policy, admin, client-config APIs |
| Data Plane | `apps/gateway/cmd/gateway` | `/mcp/{serverSlug}` Gateway, auth/policy/redaction/SSRF/audit |
| Worker Plane | `apps/worker/cmd/worker` | health, scan, schema-diff, cleanup, audit-export jobs |
| Operator Plane | `apps/cli/cmd/mcphubctl` | Control Plane API를 호출하는 operator CLI |
| Web Plane | `apps/web` | Next.js Web console, generated API client boundary 사용 |

## 주요 시작점

- `apps/api/cmd/api`
- `apps/gateway/cmd/gateway`
- `apps/worker/cmd/worker`
- `apps/cli/cmd/mcphubctl`
- `apps/web`
- `internal/`
- `schemas/openapi/mcp-hub.openapi.yaml`
- `schemas/jsonschema/`

## 로컬 개발 명령

```bash
pnpm install
cp .env.example .env
pnpm dev:infra
pnpm dev
```

검증:

```bash
make lint
make test
make build
make ci
make demo-check
```

문서 사이트 검증:

```bash
uv sync --group docs
uv run --group docs mkdocs build --strict
```

## 기존 개발 문서

| 문서 | 사용 시점 |
| --- | --- |
| [Architecture](../ARCHITECTURE.md) | runtime planes, Go/Web/schema 경계 확인 |
| [Local Development](../LOCAL_DEV.md) | 로컬 stack, seed data, reset flow |
| [API](../API.md) | Control Plane routes와 local curl checks |
| [Contracts](../CONTRACTS.md) | OpenAPI, JSON Schema, generated Web client |
| [Gateway](../GATEWAY.md) | Gateway auth, policy, redaction, proxy behavior |
| [Worker](../WORKER.md) | Worker jobs와 `/jobs/run` |
| [CLI](../CLI.md) | `mcphubctl` commands |
| [Data Model](../DATA_MODEL.md) | store areas, schema boundaries, migration notes |
| [Testing](../TESTING.md) | Go, TS, e2e, security, schema, Helm validation |
| [Web Auth Route Split](../WEB_AUTH_ROUTE_SPLIT.md) | browser auth와 route split |

!!! note "TypeScript 범위"
    TypeScript workspace는 Web 전용이다. 현재 active workspace package는 `apps/web`과 `packages/ui`다. Go server/operator runtime을 TypeScript로 추가하지 않는다.
