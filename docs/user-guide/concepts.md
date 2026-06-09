# Concepts

이 문서는 MCP Hub의 사용자 화면과 Gateway 동작을 이해해야 하는 일반 사용자를 위한 용어 설명이다.

| 용어 | 설명 |
| --- | --- |
| MCP Hub | MCP server catalog, grant, policy, Gateway, client config 생성을 묶는 내부 플랫폼 skeleton이다. |
| MCP server | MCP tool/resource/prompt를 제공하는 upstream server다. 이 저장소의 first-party server는 Go로 작성된다. |
| Catalog | 사용 가능한 MCP server와 tool metadata를 보여주는 목록이다. Web에서는 `/user/catalog`에서 확인한다. |
| Grant | 특정 사용자, 팀, 프로젝트, client가 어떤 server/tool을 사용할 수 있는지 나타내는 권한이다. |
| Tool | MCP JSON-RPC `tools/list`와 `tools/call`에서 노출되는 기능 단위다. |
| Client config | `opencode` 같은 MCP client가 Gateway `/mcp/{serverSlug}`로 연결할 수 있게 만드는 설정 snippet이다. |
| Gateway | `apps/gateway/cmd/gateway`에서 실행되는 Data Plane이다. `/mcp/{serverSlug}` 요청에 auth, policy, redaction, SSRF checks, circuit breaking, audit를 적용한다. |
| User/admin route split | Web route가 `/user/*`와 `/admin/*`로 분리된 모델이다. 사용자는 catalog/access/client config를 보고, platform admin은 approvals/audit/operations/emergency를 다룬다. |
| `k8s-readonly` | 로컬 seed data에 포함된 Kubernetes read-only MCP server slug다. grant된 tool은 `list_namespaces`, `list_pods`, `get_pod`이다. |
| `dev-admin-token` | 로컬 데모용 mock admin bearer token이다. 운영 환경에서 사용하지 않는다. |

!!! warning "운영 주의"
    `dev-admin-token`, `dev-readonly-token`, mock auth, dev provider는 로컬 개발과 데모용이다. 운영 환경의 Gateway bearer auth와 Web browser auth는 OIDC 또는 명시적으로 구성된 provider를 사용해야 한다.

## 요청이 지나가는 경로

```text
MCP client -> Gateway /mcp/{serverSlug} -> upstream MCP server
Web user -> Next.js server action/page -> Control Plane API
operator -> mcphubctl -> Control Plane API
```

Browser session cookie는 Gateway MCP bearer token으로 사용되지 않는다. Web auth와 Gateway auth는 분리되어 있다.
