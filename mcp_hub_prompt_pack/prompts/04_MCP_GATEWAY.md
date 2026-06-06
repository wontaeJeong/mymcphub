# 04. MCP Gateway 구현

MCP Hub의 Data Plane인 `apps/gateway`를 구현한다. Gateway는 MCP client가 접속하는 단일 remote MCP endpoint 역할을 한다.

## 입력 전제

`00_CONTEXT.md`, `02_SHARED_SCHEMA_DB_MODEL.md`, `03_CONTROL_PLANE_API.md` 결과물을 기준으로 작업한다.

## 작업 목표

다음 endpoint 형태를 제공한다.

```txt
POST /mcp/:serverSlug
GET  /mcp/:serverSlug
```

Gateway는 MCP Streamable HTTP endpoint처럼 동작하며, 내부적으로 등록된 upstream MCP server로 요청을 라우팅한다.

## 필수 책임

1. OAuth/OIDC bearer token 검증
2. serverSlug -> server lookup
3. server enabled 여부 확인
4. session 생성/조회
5. MCP initialize 처리 또는 upstream 전달
6. `tools/list` 응답 필터링
7. `tools/call` 요청 authorization
8. upstream timeout/circuit breaker
9. audit event 기록
10. structured logging
11. metrics/tracing hook

## MCP 메시지 처리 요구사항

최소 다음 method를 식별하고 처리한다.

```txt
initialize
notifications/initialized
tools/list
tools/call
resources/list
resources/read
prompts/list
prompts/get
ping
```

초기 구현에서 모든 method를 완벽히 구현하지 못하더라도, unknown method는 안전하게 upstream에 proxy하고 audit metadata를 남긴다.

## Authorization 요구사항

### tools/list

- upstream에서 받은 tool 목록을 그대로 client에 반환하지 않는다.
- 현재 user/team/project/client_id 기준으로 허용된 tool만 반환한다.
- disabled tool은 항상 제거한다.
- server disabled 상태면 403 또는 MCP error를 반환한다.

### tools/call

- tool name을 추출한다.
- policy input을 구성한다.

```txt
user_id
team_ids
project_id
client_id
server_id
server_slug
tool_name
environment
risk_level
request_time
```

- allowed가 아니면 upstream 호출 없이 deny한다.
- deny도 audit event로 남긴다.

## Audit 요구사항

모든 MCP 요청에 대해 최소한 다음을 남긴다.

```txt
trace_id
session_id
user_id
client_id
server_id
method
tool_name nullable
policy_decision
latency_ms
upstream_status
error_code nullable
argument_hash nullable
argument_redacted_json nullable
```

arguments 전체 원문을 무조건 저장하지 않는다. redaction 함수를 만든다.

## Upstream transport

초기 구현은 다음을 지원한다.

1. `streamable_http`
2. `external`
3. `stdio_adapter`는 interface만 만들고 실제 구현은 별도 prompt에서 진행

## Circuit breaker

최소한 다음 정책을 구현한다.

- upstream timeout
- 연속 실패 횟수 기록
- 일정 횟수 이상 실패 시 degraded state
- degraded state에서도 health check 복구 가능

## 완료 조건

- local echo MCP server에 Gateway를 통해 연결 가능
- bearer token 없는 요청은 거부
- disabled server 접근 거부
- tools/list filtering 동작
- tools/call authorization 동작
- audit event 기록
- unit/integration test 작성
- `apps/gateway/README.md`에 client 연결 예시 포함
