# Approvals

이 문서는 사용자 grant request를 승인, 거절, 회수하는 플랫폼 관리자를 위한 안내다.

## Web surface

`/admin/approvals`는 pending grant request와 approval workflow controls를 보여준다. 일반 사용자의 `/user/access`에서 생성되거나 표시되는 request는 관리자 승인 흐름으로 연결된다.

| 작업 | 의미 |
| --- | --- |
| Approve | 요청된 server/tool 접근을 grant로 전환한다. |
| Reject | 요청을 거절하고 권한을 부여하지 않는다. |
| Revoke | 기존 활성 grant를 회수한다. |

승인 관련 mutation은 platform-admin context가 필요하고 audit event를 남겨야 한다.

## Local seed 예시

로컬 seed data는 `k8s-readonly` server와 grant된 tools `list_namespaces`, `list_pods`, `get_pod`를 포함한다. 사용자는 `/user/access`에서 표시 가능한 grant를 확인하고, 관리자는 `/admin/approvals`에서 approval queue와 관련 action을 확인한다.

## 승인 판단 기준

| 확인 항목 | 이유 |
| --- | --- |
| Server slug와 owner team | 책임 팀과 운영 범위를 확인한다. |
| Tool risk level | high/critical tool은 명시적 검토가 필요하다. |
| 요청 주체 | 사용자/팀/프로젝트/client가 실제 필요 권한인지 확인한다. |
| Policy tags | readonly, dlp, kubernetes 등 정책 적용 여부를 확인한다. |
| Audit trace | 이전 deny, needs_approval, emergency state와 충돌하지 않는지 확인한다. |

!!! warning "과도한 권한 방지"
    전체 server grant가 필요한지, 특정 tool grant로 충분한지 먼저 확인한다. 권한은 필요한 범위로 좁게 부여한다.

## 관련 문서

- [Policy](../POLICY.md)
- [Audit Observability](../AUDIT_OBSERVABILITY.md)
- [User Access Requests](../user-guide/access.md)
