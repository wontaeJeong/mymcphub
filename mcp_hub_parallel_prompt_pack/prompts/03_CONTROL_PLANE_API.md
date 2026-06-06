# 03. Control Plane API 구현

MCP Hub의 관리 API를 구현한다. 이 API는 Web UI, Worker, 운영 자동화가 사용하는 Control Plane이다.

## 입력 전제

`00_CONTEXT.md`, `01_CREATE_MONOREPO.md`, `02_SHARED_SCHEMA_DB_MODEL.md` 결과물을 기준으로 작업한다.

## 작업 목표

`apps/api`에 HTTP API 서버를 구현한다.

## 필수 기능

1. Health API
2. Auth context middleware
3. Server Catalog API
4. Tool Catalog API
5. Grant API
6. Approval API
7. Audit Search API
8. Client Config Generator API
9. Admin emergency controls

## API Endpoint 초안

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
PATCH  /api/servers/:serverId/tools/:toolId
POST   /api/servers/:serverId/tools/:toolId/disable
POST   /api/servers/:serverId/tools/:toolId/enable

GET    /api/grants
POST   /api/grants
PATCH  /api/grants/:grantId
POST   /api/grants/:grantId/revoke

GET    /api/approvals
POST   /api/approvals
POST   /api/approvals/:approvalId/approve
POST   /api/approvals/:approvalId/reject

GET    /api/audit-events
GET    /api/tool-call-events
GET    /api/server-health

POST   /api/client-config/generate
POST   /api/admin/emergency-deny
POST   /api/admin/revoke-server-grants/:serverId
```

## 인증 요구사항

- 로컬 개발에서는 mock auth를 지원한다.
- 실제 운영에서는 OIDC JWT 검증이 가능해야 한다.
- 인증 middleware는 다음 정보를 request context에 넣는다.

```txt
user_id
email
display_name
team_ids
roles
client_id
issuer
audience
```

## OpenAPI 요구사항

- OpenAPI spec을 생성한다.
- `schemas/openapi/control-plane.openapi.json` 또는 `.yaml`로 export한다.
- request/response schema는 shared schema와 최대한 일치시킨다.

## Error model

공통 error response를 만든다.

```json
{
  "error": {
    "code": "MCP_SERVER_NOT_FOUND",
    "message": "MCP server not found",
    "details": {}
  },
  "traceId": "..."
}
```

## Client Config Generator

다음 client별 설정 snippet 생성을 지원하는 구조를 만든다.

- generic remote MCP
- opencode
- Claude Code style JSON
- Codex style JSON placeholder
- VS Code style placeholder

실제 client별 포맷이 확정되지 않은 경우 placeholder임을 명확히 표시하고, formatter interface를 분리한다.

## 완료 조건

- API 서버 로컬 실행 가능
- OpenAPI 생성 가능
- seed data 기준으로 server 목록 조회 가능
- grant 생성/조회 가능
- approval approve/reject 가능
- audit search pagination 가능
- integration test 작성
- README에 curl 예시 포함
