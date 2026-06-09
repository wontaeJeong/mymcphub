# Admin Guide

이 문서는 MCP Hub Web console에서 서버 운영, 승인, audit, emergency control을 수행하는 플랫폼 관리자를 위한 안내다.

관리자 route는 platform admin 권한을 요구한다. non-admin 사용자가 `/admin` 또는 `/admin/*`에 접근하면 forbidden page가 표시된다.

!!! warning "권한 경계"
    관리자 화면은 server mutation, approval decision, audit export, emergency deny 같은 audit-worthy 작업을 다룬다. 로컬 demo token과 mock auth를 운영 권한 모델로 사용하지 마라.

## Admin routes

| Route | 용도 |
| --- | --- |
| `/admin` | 관리자 홈과 주요 운영 surface 링크 |
| `/admin/servers` | 서버 catalog 운영, 등록, 상태 제어 |
| `/admin/servers/[serverId]` | 한 서버의 상세, tools, versions/rollout, health, runtime 정보 |
| `/admin/approvals` | grant request 승인/거절/회수 흐름 |
| `/admin/audit` | audit search, Gateway/API 이벤트 검토, export |
| `/admin/operations` | server health, runtime status, usage/denied-call analytics |
| `/admin/emergency` | emergency deny, kill switch, server grant revoke |

## 관리자 작업 맵

| 작업 | 문서 | 관련 기존 문서 |
| --- | --- | --- |
| 서버 등록과 운영 | [Server Operations](server-operations.md) | [API](../API.md), [MCP Server Onboarding](../MCP_SERVER_ONBOARDING.md) |
| 접근 요청 처리 | [Approvals](approvals.md) | [Policy](../POLICY.md), [Audit Observability](../AUDIT_OBSERVABILITY.md) |
| 감사 검색/내보내기 | [Audit](audit.md) | [Audit Observability](../AUDIT_OBSERVABILITY.md), [CLI](../CLI.md) |
| 긴급 차단/회수 | [Emergency Controls](emergency.md) | [Runbooks](../RUNBOOKS.md), [Security](../SECURITY.md) |

## 로컬 확인

```bash
pnpm dev:infra
pnpm dev
```

브라우저에서 `http://localhost:3000`을 열고 dev admin flow로 진입하면 `/admin`으로 이동한다.
