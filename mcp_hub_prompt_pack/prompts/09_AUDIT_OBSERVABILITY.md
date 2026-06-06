# 09. Audit 및 Observability 구현

MCP Hub의 감사로그, metrics, tracing 구조를 구현한다.

## 입력 전제

`00_CONTEXT.md`, `03_CONTROL_PLANE_API.md`, `04_MCP_GATEWAY.md`, `08_AUTH_POLICY_APPROVAL.md` 결과물을 기준으로 작업한다.

## 작업 목표

Gateway/API/Worker 전반에 걸친 trace 기반 audit와 observability를 구현한다.

## Audit 원칙

- agent의 자연어 답변을 감사 기준으로 삼지 않는다.
- Gateway에서 관측한 MCP request/response metadata를 source of truth로 삼는다.
- 민감 argument 원문은 저장하지 않는다.
- redaction과 hash를 분리한다.

## Audit event 유형

```txt
auth.success
auth.failure
server.connect.allowed
server.connect.denied
tool.discovery.allowed
tool.discovery.filtered
tool.call.allowed
tool.call.denied
tool.call.succeeded
tool.call.failed
server.disabled
tool.disabled
grant.created
grant.revoked
approval.created
approval.approved
approval.rejected
schema.changed
health.changed
emergency_policy.enabled
emergency_policy.disabled
```

## Redaction 요구사항

1. argument 전체 원문 저장 금지
2. key 기반 redaction

```txt
password
passwd
token
secret
apiKey
apikey
authorization
cookie
kubeconfig
privateKey
```

3. argument hash는 stable hash로 계산
4. 저장 예시

```json
{
  "namespace": "default",
  "podName": "api-xxx",
  "token": "[REDACTED]"
}
```

## Metrics 요구사항

Prometheus metrics endpoint를 제공한다.

```txt
GET /metrics
```

필수 metric:

```txt
mcp_gateway_requests_total
mcp_gateway_request_duration_ms
mcp_gateway_tool_calls_total
mcp_gateway_tool_call_duration_ms
mcp_gateway_policy_denies_total
mcp_gateway_upstream_errors_total
mcp_gateway_active_sessions
mcp_worker_scan_total
mcp_worker_schema_changes_total
mcp_api_requests_total
```

Label cardinality를 과하게 늘리지 않는다. user_id 같은 고카디널리티 label은 metric label로 넣지 않는다.

## Tracing 요구사항

OpenTelemetry hook을 추가한다.

Trace span 예시:

```txt
mcp.gateway.request
mcp.gateway.auth
mcp.gateway.policy_decision
mcp.gateway.upstream_call
mcp.gateway.audit_write
mcp.worker.tool_scan
mcp.api.request
```

trace_id를 audit event에 저장한다.

## Audit Search API

다음 필터를 지원한다.

- time range
- user
- team
- project
- server
- tool
- event_type
- policy_decision
- risk_level
- trace_id

Pagination을 지원한다.

## 완료 조건

- Gateway/API/Worker에 structured logger 적용
- audit writer 구현
- redaction test 작성
- metrics endpoint 구현
- trace_id propagation 구현
- Web UI audit log와 연동
- docs/AUDIT_OBSERVABILITY.md 작성
