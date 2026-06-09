# Server Operations

이 문서는 MCP server를 등록, 노출, 중지, 격리하고 rollout 상태를 확인하는 플랫폼 관리자를 위한 안내다.

## Web surface

| Route | 역할 |
| --- | --- |
| `/admin/servers` | 서버 목록, 등록 form, 운영 action entry |
| `/admin/servers/[serverId]` | 서버 상세, tool, version, rollout, health/runtime 정보 |

사용자 catalog와 달리 관리자 화면은 server lifecycle mutation을 다룬다. Control Plane mutation은 platform-admin context가 필요하고 audit event를 남겨야 한다.

## Control Plane 개념

[Control Plane API](../API.md)는 다음 server operation 개념을 포함한다.

| 개념 | 설명 |
| --- | --- |
| Register/update | server slug, display name, owner team, environment, transport, upstream URL, tools를 등록/수정한다. |
| Enable/disable | Gateway와 catalog에서 server 사용 가능 여부를 바꾼다. |
| Publish/unpublish | 사용자 catalog 노출 상태를 바꾼다. |
| Quarantine | prompt-injection-like metadata, 보안 이슈, 사고 대응 시 server를 격리한다. |
| Tool enable/disable | server 단위가 아니라 tool 단위로 노출을 제어한다. |
| Versions/rollout | `/api/servers/{serverId}/versions`, activate/rollback, `/api/servers/{serverId}/rollout`로 version metadata와 GitOps 정보를 확인한다. |
| Runtime status | `/api/runtime/status`, `/api/runtime/secret-leases`로 rendered runtime 상태와 secret reference lease metadata를 본다. |

!!! note "현재 UI 제한사항"
    Web UI는 현재 구현된 server registration/operations surface를 제공하지만, 모든 API route의 세부 필드를 완전한 운영 콘솔로 대체하지 않는다. 상세 route, schema, version/rollout 필드는 [API](../API.md), [Data Model](../DATA_MODEL.md), [MCP Server Onboarding](../MCP_SERVER_ONBOARDING.md)를 기준으로 확인한다.

## 로컬 seed server

| 항목 | 값 |
| --- | --- |
| Slug | `k8s-readonly` |
| ID | `00000000-0000-4000-8000-000000000102` |
| Upstream sample | `http://localhost:5102/mcp` |
| Gateway route | `http://localhost:5000/mcp/k8s-readonly` |
| Tools | `list_namespaces`, `list_pods`, `get_pod` |

서버 목록은 API로도 확인할 수 있다.

```bash
curl http://localhost:4000/api/servers
```

## 운영 전 체크

1. owner team과 environment를 확인한다.
2. transport와 upstream URL이 Gateway SSRF 정책을 통과할 수 있는지 확인한다.
3. high/critical tool 변경은 policy/grant review를 거친다.
4. secret 값은 manifest, docs, Helm values, log, UI에 직접 넣지 않는다.
5. 상태 변경 후 `/admin/audit`와 `/admin/operations`에서 audit/health를 확인한다.
