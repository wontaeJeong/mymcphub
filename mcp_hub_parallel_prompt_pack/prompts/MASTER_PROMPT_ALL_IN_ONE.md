# MCP Hub 전체 구현 통합 프롬프트

현재 작업 디렉토리 아래에 웹 UI를 포함한 MCP Hub 모노레포를 생성하고, 운영 가능한 MVP 수준까지 구현한다.

## 목표

사내에서 운영할 수 있는 MCP Hub를 만든다. 이 Hub는 단순 MCP 서버 모음이 아니라 다음을 제공해야 한다.

- Web UI
- Control Plane API
- MCP Gateway
- Worker
- MCP Server Catalog
- OIDC/OAuth 기반 인증 구조
- server-level 및 tool-level authorization
- approval workflow
- audit log
- observability
- first-party MCP server 예시
- stdio adapter 구조
- Helm/GitOps 배포
- local dev environment
- test/CI/security scan 기본 구조
- 운영 문서/runbook

## 권장 스택

- TypeScript
- pnpm workspace
- Turborepo
- Next.js App Router for web
- Fastify 또는 Hono for API/Gateway
- PostgreSQL
- Redis optional
- Drizzle 또는 Prisma
- Zod schema
- Vitest
- Docker
- Helm
- GitOps overlay

## 생성할 구조

```txt
mcp-hub
├── apps
│   ├── web
│   ├── api
│   ├── gateway
│   ├── worker
│   └── stdio-adapter
├── servers
│   ├── echo
│   ├── internal-docs
│   ├── k8s-readonly
│   └── stdio-sample
├── packages
│   ├── auth
│   ├── config
│   ├── db
│   ├── logger
│   ├── mcp-protocol
│   ├── policy
│   └── ui
├── schemas
│   ├── openapi
│   ├── catalog
│   └── policy
├── deploy
│   ├── helm/mcp-hub
│   └── gitops
│       ├── base
│       └── overlays
│           ├── dev
│           ├── stg
│           └── prod
├── docs
├── scripts
├── tests
├── compose.yaml
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
└── README.md
```

## 필수 구현 범위

### 1. Monorepo

- pnpm workspace + turbo 설정
- lint/typecheck/test/build script 구성
- 각 app/package package.json 구성
- 공통 tsconfig/eslint/prettier 구성

### 2. DB 및 Schema

다음 테이블 또는 equivalent model을 구현한다.

```txt
users
teams
team_memberships
projects
project_memberships
mcp_servers
mcp_server_versions
mcp_tools
mcp_tool_schemas
mcp_grants
approval_requests
oauth_clients
mcp_sessions
audit_events
tool_call_events
server_health_checks
secret_refs
policy_versions
```

Migration과 seed를 제공한다.

### 3. Control Plane API

다음 endpoint 계열을 구현한다.

```txt
GET    /healthz
GET    /readyz
GET    /api/me
GET    /api/servers
POST   /api/servers
GET    /api/servers/:serverId
PATCH  /api/servers/:serverId
POST   /api/servers/:serverId/disable
POST   /api/servers/:serverId/enable
GET    /api/servers/:serverId/tools
POST   /api/grants
GET    /api/grants
POST   /api/grants/:grantId/revoke
POST   /api/approvals
GET    /api/approvals
POST   /api/approvals/:approvalId/approve
POST   /api/approvals/:approvalId/reject
GET    /api/audit-events
GET    /api/server-health
POST   /api/client-config/generate
POST   /api/admin/emergency-deny
```

OpenAPI spec을 생성한다.

### 4. MCP Gateway

Gateway endpoint:

```txt
POST /mcp/:serverSlug
GET  /mcp/:serverSlug
GET  /healthz
GET  /metrics
```

Gateway는 다음을 수행한다.

- bearer token 검증
- server lookup
- enabled 상태 확인
- session 관리
- `tools/list` filtering
- `tools/call` authorization
- upstream proxy
- timeout/circuit breaker
- audit logging
- metrics/tracing hook

권한 없는 tool은 discovery 응답에도 노출하지 않는다. call 시점에도 재검증한다.

### 5. Policy

`packages/policy`에 다음 decision model을 구현한다.

```ts
type PolicyDecisionResult = {
  allowed: boolean;
  reasonCode: string;
  reason: string;
  matchedGrantIds: string[];
  requiresApproval?: boolean;
  requiresStepUp?: boolean;
};
```

규칙:

- disabled server deny
- disabled tool deny
- expired grant deny
- server-level connect grant 필요
- tool-level grant 필요
- high/critical risk tool은 explicit allow 필요
- prod environment는 별도 grant 필요
- admin action은 admin role 필요

### 6. Web UI

Next.js로 다음 화면을 만든다.

- Dashboard
- Server Catalog
- Server Detail
- Tool Explorer
- Access Request / Grants
- Approval Queue
- Audit Log
- Health / Operations
- Client Config Generator
- Admin Emergency Controls

### 7. First-party MCP servers

다음 서버를 만든다.

- echo: echo_message, get_server_time
- internal-docs: search_docs, read_doc
- k8s-readonly: list_namespaces, list_pods, get_pod

`k8s-readonly`는 mock mode로 먼저 동작하게 하고, write/admin tool은 넣지 않는다.

### 8. stdio adapter

stdio MCP server를 별도 adapter process/pod로 감싸는 구조를 만든다.

- Gateway가 직접 subprocess를 실행하지 않는다.
- adapter가 stdio process를 관리한다.
- timeout/crash/health를 처리한다.
- sample stdio server를 제공한다.

### 9. Audit/Observability

- structured logging
- audit event writer
- argument redaction
- stable argument hash
- Prometheus metrics
- OpenTelemetry hook
- trace_id propagation

### 10. Helm/GitOps

- Helm chart
- dev/stg/prod values
- Kubernetes hardening
- NetworkPolicy
- Ingress
- GitOps overlay

### 11. Local dev

- compose.yaml
- postgres/redis/mock-oidc
- dev scripts
- smoke test

### 12. Security

- MCP manifest check
- dependency/image/secret scan script placeholder
- runtime hardening docs
- emergency kill switch

### 13. Tests/CI

- unit test
- integration test
- gateway authorization test
- API grant/approval test
- helm template test
- CI workflow

### 14. Docs

다음 문서를 작성한다.

```txt
docs/ARCHITECTURE.md
docs/LOCAL_DEV.md
docs/DATA_MODEL.md
docs/API.md
docs/GATEWAY.md
docs/POLICY.md
docs/AUDIT_OBSERVABILITY.md
docs/SECURITY.md
docs/DEPLOYMENT.md
docs/RELEASE.md
docs/RUNBOOK.md
docs/CLIENT_SETUP.md
docs/MCP_SERVER_ONBOARDING.md
```

## 완료 조건

다음 명령이 성공해야 한다.

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

가능하면 다음도 성공하게 한다.

```bash
pnpm dev:infra
pnpm db:migrate
pnpm db:seed
pnpm smoke:test
helm template mcp-hub deploy/helm/mcp-hub
```

## 마지막 응답에 포함할 것

작업 완료 후 다음을 요약한다.

1. 생성한 디렉토리 구조
2. 핵심 구현 파일
3. 실행 방법
4. 테스트 방법
5. 아직 placeholder인 부분
6. 다음 작업 권장 순서
