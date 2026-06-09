# Glossary

이 문서는 MCP Hub 사용자, 관리자, 개발자, 운영자가 같은 용어를 같은 의미로 쓰기 위한 용어집이다.

| 용어 | 설명 |
| --- | --- |
| MCP | Model Context Protocol. MCP client와 MCP server 사이에서 tool/resource/prompt를 JSON-RPC 등으로 교환하는 프로토콜이다. |
| MCP Hub | MCP server catalog, grant, Gateway, Control Plane API, Worker, Web, CLI를 묶는 내부 플랫폼 skeleton이다. |
| MCP server | MCP tool/resource/prompt를 제공하는 upstream server다. |
| MCP client | Gateway 또는 MCP server에 연결해 tool을 호출하는 client다. `opencode` 설정 생성이 문서화되어 있다. |
| Control Plane | `apps/api/cmd/api`. catalog, grants, approvals, audit, policy, admin, client-config API를 제공한다. |
| Gateway / Data Plane | `apps/gateway/cmd/gateway`. `/mcp/{serverSlug}` 요청에 auth, policy, redaction, SSRF checks, circuit breaking, audit를 적용한다. |
| Worker | `apps/worker/cmd/worker`. health, scan, schema-diff, cleanup, audit-export job을 실행한다. |
| Operator CLI | `apps/cli/cmd/mcphubctl`. Control Plane API를 호출하는 운영자 CLI다. |
| catalog | 사용자와 관리자가 server/tool metadata를 탐색하는 목록이다. |
| server slug | Gateway route에 쓰이는 server 식별자다. 예: `k8s-readonly`. |
| tool | MCP server가 노출하는 호출 가능한 기능 단위다. |
| grant | 사용자, 팀, 프로젝트, client가 server/tool을 사용할 수 있는 권한이다. |
| approval | grant request를 platform admin이 승인/거절/회수하는 절차다. |
| audit event | API/Gateway/Worker가 남기는 감사 이벤트다. 정책 결정, admin mutation, tool call context를 추적한다. |
| redaction | secret/token/password/credential 성격 값을 마스킹하거나 hash 처리하는 보안 처리다. |
| policy | 어떤 주체가 어떤 server/tool을 어떤 조건에서 사용할 수 있는지 결정하는 권한 모델이다. |
| quarantine | prompt-injection-like metadata 또는 보안 이슈가 있는 server/tool을 격리하는 상태다. |
| kill switch | 사고 중 server 접근을 광범위하게 차단하거나 grant를 회수하는 emergency admin control이다. |
| client config | MCP client가 Gateway endpoint와 bearer auth 환경변수 placeholder를 사용하도록 만드는 설정 snippet이다. |
| OIDC | OpenID Connect. 운영 Web/Gateway auth에서 사용하는 identity provider 연동 방식이다. |
| mock auth | 로컬 데모/테스트용 auth mode다. 운영 환경에서 사용하지 않는다. |
| dev provider | non-production Web에서 사용할 수 있는 개발용 로그인 provider다. |
| transport | MCP server와 통신하는 방식이다. 현재 first-party docs는 `streamable_http`와 `stdio` adapter 개념을 다룬다. |
| stdio | subprocess standard input/output으로 MCP를 연결하는 transport 방식이다. `runtime-adapter`가 관련된다. |
| HTTP | Gateway와 streamable MCP server 사이에서 사용하는 네트워크 transport다. |
| JSON-RPC | MCP request/response의 메시지 형식이다. 예: `tools/list`, `tools/call`. |
| schema diff | tool schema 변경을 비교해 added/removed/changed/risk-change metadata를 기록하는 worker/API 개념이다. |
| rollout | server version activation, rollback target, image digest, GitOps metadata를 다루는 배포 상태 개념이다. |

!!! note "현재 구현 상태"
    몇몇 운영 용어는 API/schema/Worker skeleton에 존재하지만 durable persistence나 production automation과 동일하지 않다. 현재 동작은 [Architecture](../ARCHITECTURE.md), [API](../API.md), [Data Model](../DATA_MODEL.md)를 기준으로 확인한다.
