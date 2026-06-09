# mymcphub 문서

이 문서는 MCP Hub를 로컬에서 사용하거나 운영, 개발, 검증하려는 사용자, 플랫폼 관리자, 개발자, 운영자를 위한 공식 문서 사이트의 시작점이다.

MCP Hub는 MCP server 카탈로그, 접근 권한, Gateway, Control Plane API, Worker, Web console, `mcphubctl` CLI를 하나의 내부 플랫폼으로 묶는 프로젝트다. 현재 저장소는 Go core와 first-party MCP servers, Next.js Web console, OpenAPI/JSON Schema 계약, Helm/GitOps 배포 자산을 함께 포함한다.

## 주요 사용자

| 대상 | 주로 보는 문서 | 하는 일 |
| --- | --- | --- |
| 일반 사용자 | [User Guide](user-guide/index.md) | 카탈로그 탐색, 접근 요청, 현재 grant 확인, client config 생성 |
| 플랫폼 관리자 | [Admin Guide](admin-guide/index.md) | 서버 운영, 승인 처리, audit 검토, emergency control 수행 |
| 개발자 | [Developer Guide](developer-guide/index.md) | Go core, Web, schema, tests, local dev loop 개발 |
| 운영자 | [Operations](operations/index.md) | CI, Helm/GitOps, runbook, rollback, 보안/감사 운영 |

## 현재 MVP가 제공하는 것

| 영역 | 현재 구현 기준 |
| --- | --- |
| Catalog browsing | Web `/user/catalog`, `/user/servers/[serverId]`, Control Plane `/api/servers` |
| Access request/current grants | Web `/user/access`, approval flow와 현재 표시 가능한 grant |
| Client config generation | Web `/user/client-config`, API `/api/client-config/generate`, CLI `client config` |
| User/admin route split | `/user/*`와 `/admin/*` 분리, legacy flat route redirect |
| Control Plane API | `apps/api/cmd/api`, 기본 `http://localhost:4000` |
| Gateway | `apps/gateway/cmd/gateway`, `/mcp/{serverSlug}` 프록시와 정책 적용 |
| Worker | `apps/worker/cmd/worker`, health/schema/audit 관련 job skeleton |
| Operator CLI | `apps/cli/cmd/mcphubctl`, API 기반 operator command |
| First-party MCP servers | `servers/k8s`, `runtime-adapter`, `github`, `gitlab`, `internal-docs` |

!!! warning "로컬 데모 토큰"
    `dev-admin-token`과 mock auth는 로컬 데모용이다. 운영 환경에서 사용하지 마라.

## 빠른 시작

로컬 MVP stack은 저장소 루트에서 다음 순서로 시작한다.

```bash
pnpm install
cp .env.example .env
pnpm dev:infra
pnpm dev
```

주요 endpoint:

| Surface | URL |
| --- | --- |
| Web | `http://localhost:3000` |
| API | `http://localhost:4000` |
| Gateway | `http://localhost:5000` |
| Worker | `http://localhost:4100` |
| Kubernetes MCP sample server | `http://localhost:5102` |

API와 Gateway를 빠르게 확인한다.

```bash
curl http://localhost:4000/healthz
curl http://localhost:4000/readyz
curl http://localhost:4000/api/servers

curl http://localhost:5000/mcp/k8s-readonly \
  -H 'authorization: Bearer dev-admin-token' \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## 문서 입구

- [User Guide](user-guide/index.md): 로컬 Web과 Gateway를 사용해 보는 흐름
- [Admin Guide](admin-guide/index.md): 플랫폼 관리자 route와 운영 작업
- [Developer Guide](developer-guide/index.md): repo 구조, runtime planes, 검증 명령
- [Operations](operations/index.md): 로컬 운영, Helm/GitOps, runbook, 보안
- [Reference](reference/index.md): 환경 변수, scripts/CLI, 용어집
- [기존 문서 인덱스](docs-index.md): 기존 `docs/README.md` 문서 맵의 MkDocs용 entry
- [MVP Demo](MVP_DEMO.md): end-to-end 데모 체크리스트

## 현재 제한사항

현재 Go core는 기존 skeleton 동작을 보존하며 `internal/db.NewSeedStore` 기반 seed data와 local runtime store를 사용한다. `MCP_STORE_PATH`가 설정되면 API, Gateway, Worker가 로컬 JSON 파일을 통해 catalog/audit/health 상태를 공유할 수 있지만, 이것은 운영용 PostgreSQL repository나 SIEM pipeline이 아니다.

Durable PostgreSQL persistence, 장기 audit retention, 외부 collector/exporter 연동은 문서화된 방향과 schema/migration 자산이 있지만 현재 구현 상태와 분리해서 보아야 한다. 현재 동작 확인은 [Architecture](ARCHITECTURE.md), [Data Model](DATA_MODEL.md), [Audit Observability](AUDIT_OBSERVABILITY.md)를 기준으로 한다.
