# Access Requests

이 문서는 현재 접근 권한을 확인하고 필요한 tool 접근을 요청하려는 일반 사용자를 위한 안내다.

## 사용자 route

`/user/access`는 Web session의 현재 사용자 또는 팀 식별자와 일치하는 grant를 보여주고, 가능한 접근 요청 controls를 제공한다.

| 항목 | 설명 |
| --- | --- |
| Current visible grants | 현재 사용자/팀에 표시 가능한 활성 grant다. |
| Grant request | 필요한 server/tool 접근을 요청하는 흐름이다. |
| Pending approval | 관리자 승인 전 상태다. |
| Rejected/revoked | 관리자가 거절하거나 회수한 접근이다. |

승인과 거절 처리는 관리자 route인 `/admin/approvals`에서 수행한다. 자세한 운영 흐름은 [Admin Approvals](../admin-guide/approvals.md)를 참고한다.

## 로컬 seed 기준 예시

로컬 seed data는 `k8s-readonly` server와 `list_namespaces`, `list_pods`, `get_pod` tool grant를 포함한다. 사용자는 `/user/access`에서 현재 세션과 일치하는 grant를 확인할 수 있다.

!!! note "현재 구현 기준"
    Web UI는 seed/store에서 반환되는 grant와 request 상태를 표시하고 server action을 통해 Control Plane API mutation을 호출한다. UI가 표시하지 않는 승인/감사 세부 필드는 [API](../API.md), [Audit Observability](../AUDIT_OBSERVABILITY.md)를 기준으로 확인한다.

## 요청 전 확인할 것

1. `/user/catalog`에서 server와 tool 이름을 확인한다.
2. `/user/servers/[serverId]`에서 현재 접근 상태를 확인한다.
3. high 또는 critical risk tool은 explicit approval이 필요할 수 있다.
4. 승인이 필요한 요청은 platform admin이 `/admin/approvals`에서 처리한다.
