# Audit

이 문서는 MCP Hub audit event를 검색하고 redacted compliance export를 검토하는 플랫폼 관리자와 운영자를 위한 안내다.

## Web surface

`/admin/audit`는 API/Gateway/Worker에서 기록된 audit event를 검색하고 운영 판단에 필요한 context를 확인하는 관리자 화면이다.

| 기능 | 현재 기준 |
| --- | --- |
| Audit search | `/api/audit-events` filter와 pagination 기반 검색 |
| Gateway event ingest | `/api/audit-events/gateway`를 통해 Gateway-observed event를 API skeleton store로 복사 가능 |
| Compliance export | `/api/audit-events/export` redacted export envelope |
| Tool-call visibility | Web `/admin/audit`와 `/admin/operations`에서 policy decision, denied call, trace context 확인 |

## API 예시

```bash
curl 'http://localhost:4000/api/audit-events?limit=25'
curl 'http://localhost:4000/api/audit-events?policy_decision=deny&limit=25'
```

Compliance export는 `from`, `to` RFC3339 date-time query parameter가 필요하다.

```bash
curl 'http://localhost:4000/api/audit-events/export?from=2026-06-07T00:00:00Z&to=2026-06-08T00:00:00Z&signed=true'
```

Signed export를 요청하면 `MCP_COMPLIANCE_EXPORT_SIGNING_KEY`가 필요하다. API와 Worker의 signed audit export는 같은 signing key를 기준으로 한다.

!!! note "현재 persistence 제한"
    현재 audit/observability data는 in-memory/file-backed skeleton store를 사용한다. 운영용 durable database, SIEM forwarding, production retention pipeline으로 간주하지 마라.

## Redaction

Audit export와 event metadata는 secret, token, password, credential 성격의 값을 redaction/hash 처리해야 한다. Raw secret이나 bearer token을 docs, logs, UI, Helm values에 남기지 않는다.

## 운영 연결

| 상황 | 다음 단계 |
| --- | --- |
| policy deny 증가 | `/admin/audit` filter와 `/admin/operations` denied-call analytics 확인 |
| high-risk tool 요청 | `/admin/approvals`에서 owner/policy review |
| 사고 징후 | [Emergency Controls](emergency.md), [Runbooks](../RUNBOOKS.md) 확인 |

자세한 field와 metric 정책은 [Audit Observability](../AUDIT_OBSERVABILITY.md)를 기준으로 한다.
