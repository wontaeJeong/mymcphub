# 00. 공통 컨텍스트: MCP Hub 모노레포

아래 전제를 모든 작업에 공통으로 적용한다.

## 목표

웹 UI를 포함한 사내 MCP Hub를 모노레포로 만든다. 이 Hub는 단순 MCP 서버 모음이 아니라 다음 기능을 제공하는 플랫폼이다.

- MCP Server Catalog
- MCP Gateway
- Control Plane API
- Web UI
- Worker 기반 tool scan/schema diff/health check
- OIDC/OAuth 기반 인증
- server-level 및 tool-level authorization
- approval workflow
- audit log
- observability
- Helm/GitOps 기반 Kubernetes 배포
- first-party MCP server 예시
- stdio MCP server를 remote endpoint로 감싸는 adapter 구조

## 기본 아키텍처

```txt
[MCP Client: opencode / Claude Code / Codex / IDE]
        |
        | Streamable HTTP + OAuth/OIDC token
        v
[Ingress]
        |
        v
[apps/gateway]
  - token validation
  - MCP session routing
  - tools/list filtering
  - tools/call authorization
  - audit logging
  - upstream timeout/circuit breaker
        |
        +--> [servers/*: managed MCP server]
        +--> [stdio adapter pods]
        +--> [external remote MCP server]

[apps/web] ---> [apps/api] ---> [PostgreSQL]
                   |
                   +-- server catalog / grants / approvals / audit search
                   +-- worker orchestration metadata

[apps/worker]
  - tools/list scan
  - schema diff
  - health check
  - risk classification
```

## 기술 스택 기본값

- package manager: pnpm
- monorepo: pnpm workspace + turborepo
- language: TypeScript
- web: Next.js App Router
- api: Fastify 또는 Hono 중 하나를 선택하되, OpenAPI 생성이 쉬운 구조로 구현
- gateway: Node.js TypeScript service
- db: PostgreSQL
- migration: Drizzle 또는 Prisma 중 하나를 선택하되, schema/migration/test가 명확해야 함
- cache/session/rate-limit: Redis를 optional dependency로 둠
- auth: OIDC/JWT 검증 구조
- deployment: Dockerfile + Helm chart + GitOps overlay
- test: vitest + supertest/undici + playwright optional
- lint/format: eslint + prettier

## 필수 설계 원칙

1. Control Plane과 Data Plane을 분리한다.
   - Control Plane: `apps/api`, `apps/web`, `apps/worker`
   - Data Plane: `apps/gateway`, `servers/*`, adapter runtime

2. MCP Gateway는 단순 reverse proxy가 아니다.
   - token 검증
   - session 관리
   - server routing
   - tools/list filtering
   - tools/call authorization
   - audit logging
   - timeout/retry/circuit breaker
   - upstream health 반영

3. tool discovery 단계에서도 권한을 필터링한다.
   - 권한 없는 tool은 `tools/list` 응답에 노출하지 않는다.
   - `tools/call` 시점에도 동일 policy를 재검증한다.

4. audit source of truth는 agent 답변이 아니라 Gateway trace다.
   - user, team, client, session, server, tool, policy decision, latency, status를 남긴다.

5. first-party MCP server는 Hub monorepo 안에서 관리한다.
   - 나중에 독립 lifecycle이 필요하면 image/version/catalog manifest만 남기고 분리할 수 있게 한다.

6. 민감 tool은 read/write/admin 서버를 분리한다.
   - 예: `k8s-readonly`와 `k8s-admin`을 한 서버에 섞지 않는다.

7. 운영자가 즉시 차단할 수 있어야 한다.
   - server disable
   - tool disable
   - grant revoke
   - emergency deny policy

## 기본 디렉토리 목표

```txt
apps/
  web/
  api/
  gateway/
  worker/
servers/
  echo/
  k8s-readonly/
  internal-docs/
packages/
  auth/
  config/
  db/
  logger/
  mcp-protocol/
  policy/
  ui/
schemas/
  openapi/
  catalog/
  policy/
deploy/
  helm/mcp-hub/
  gitops/base/
  gitops/overlays/dev/
  gitops/overlays/stg/
  gitops/overlays/prod/
docs/
scripts/
tests/
```

## 공통 완료 조건

- `pnpm install` 가능
- `pnpm lint` 가능
- `pnpm test` 가능
- `pnpm typecheck` 가능
- 로컬 개발 실행 방법이 README에 있음
- 최소 예시 seed data가 있음
- 각 app/package의 책임이 README 또는 문서에 정리됨
- mock auth로 로컬 실행 가능
- 실제 OIDC로 교체 가능한 구조
