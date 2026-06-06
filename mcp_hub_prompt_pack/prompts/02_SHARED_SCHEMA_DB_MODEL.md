# 02. Shared Schema 및 DB Model 구현

MCP Hub의 Control Plane에서 사용할 shared schema, DB schema, migration 구조를 구현한다.

## 입력 전제

`00_CONTEXT.md`와 `01_CREATE_MONOREPO.md` 결과물을 기준으로 작업한다.

## 작업 목표

다음 도메인 모델을 TypeScript type, validation schema, DB schema로 구현한다.

- User
- Team
- Project
- McpServer
- McpServerVersion
- McpTool
- McpToolSchema
- McpGrant
- ApprovalRequest
- OAuthClient
- McpSession
- AuditEvent
- ToolCallEvent
- ServerHealthCheck
- SecretRef
- PolicyVersion

## DB 필수 테이블

최소한 다음 테이블을 만든다.

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

## 핵심 필드 요구사항

### mcp_servers

- id
- slug
- display_name
- description
- owner_team_id
- environment: dev/stg/prod/shared
- transport: streamable_http/sse_legacy/stdio_adapter/external
- upstream_url
- enabled
- risk_level: low/medium/high/critical
- created_at
- updated_at

### mcp_tools

- id
- server_id
- name
- description
- enabled
- risk_level
- discovered_at
- last_seen_at

### mcp_tool_schemas

- id
- tool_id
- schema_hash
- input_schema_json
- output_schema_json optional
- description_snapshot
- version
- created_at

### mcp_grants

- id
- subject_type: user/team/service_account
- subject_id
- project_id
- server_id
- allowed_tools_json
- environment
- expires_at
- approved_by
- reason
- ticket_url
- enabled
- created_at

### audit_events

- id
- timestamp
- user_id nullable
- team_id nullable
- project_id nullable
- client_id nullable
- session_id nullable
- server_id nullable
- tool_name nullable
- event_type
- risk_level
- policy_decision
- argument_hash nullable
- argument_redacted_json nullable
- upstream_status nullable
- latency_ms nullable
- trace_id
- metadata_json

## Validation schema

`packages/*` 사이에서 공통으로 쓸 수 있게 Zod schema 또는 동등한 runtime validation schema를 만든다.

필수 schema:

- `McpServerManifestSchema`
- `McpToolSchema`
- `McpGrantSchema`
- `PolicyDecisionInputSchema`
- `PolicyDecisionResultSchema`
- `AuditEventSchema`
- `HealthCheckResultSchema`

## Migration/Seed

1. migration command를 추가한다.
2. seed command를 추가한다.
3. seed data에는 다음을 포함한다.
   - admin user
   - platform team
   - sample project
   - echo MCP server
   - internal-docs MCP server
   - k8s-readonly MCP server
   - sample grant

## 완료 조건

- migration 생성 및 실행 가능
- seed 실행 가능
- typecheck 통과
- 최소 repository/service 함수 구현
- `packages/db/README.md`에 schema 설명 포함
- `docs/DATA_MODEL.md` 작성
