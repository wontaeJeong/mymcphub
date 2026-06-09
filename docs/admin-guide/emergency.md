# Emergency Controls

이 문서는 인시던트 중 MCP server 또는 tool 접근을 긴급 차단하거나 grant를 회수해야 하는 플랫폼 관리자를 위한 안내다.

## Web surface

`/admin/emergency`는 emergency deny, kill switch, server grant revoke 같은 고위험 운영 action을 제공한다.

| 제어 | 관련 API 개념 | 사용 시점 |
| --- | --- | --- |
| Emergency deny | `/api/admin/emergency-deny`, disable route | 특정 server/tool/policy 조건을 즉시 거부해야 할 때 |
| Kill switch | `/api/admin/kill-switch` | server incident 중 광범위한 차단과 선택적 grant revoke가 필요할 때 |
| Revoke server grants | `/api/admin/revoke-server-grants/{serverId}` | 한 server에 대한 활성 grant를 회수해야 할 때 |

!!! danger "오용 방지"
    Emergency control은 정상 사용자 workflow를 중단할 수 있다. 사유, 대상 server/tool, 예상 영향, rollback 조건을 남기고 실행한다.

## 운영 절차

1. `/admin/audit`에서 trace, server slug, tool, policy decision을 확인한다.
2. `/admin/operations`에서 health, denied-call analytics, runtime status를 확인한다.
3. 필요한 최소 범위의 emergency control을 선택한다.
4. 조치 후 audit event가 남았는지 확인한다.
5. incident 종료 후 disable/revoke/rollback 절차를 명확히 수행한다.

## Gateway와의 관계

Gateway는 disabled 또는 quarantined server를 upstream call 전에 거부한다. Emergency deny나 kill switch는 Gateway policy/auth/redaction/SSRF boundary를 우회하지 않고, upstream 호출 전 차단을 목표로 한다.

## 관련 runbook

- [Runbooks](../RUNBOOKS.md)
- [Detailed Runbook](../RUNBOOK.md)
- [Security](../SECURITY.md)
- [Audit Observability](../AUDIT_OBSERVABILITY.md)
