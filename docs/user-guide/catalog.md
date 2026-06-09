# Catalog

이 문서는 MCP Hub에서 사용할 수 있는 MCP server와 tool을 찾으려는 일반 사용자를 위한 안내다.

## 사용자 route

| Route | 용도 |
| --- | --- |
| `/user/catalog` | enabled/published server 목록과 tool 요약을 본다. |
| `/user/servers/[serverId]` | 한 server의 상세, tool, 접근 상태를 본다. |

Legacy `/catalog`, `/tools`, `/servers/[serverId]` route는 현재 가장 가까운 `/user/*` surface로 redirect된다.

## Enabled와 published

Control Plane API의 catalog route는 server의 enabled/published 상태와 환경, risk, owner team, transport, query filter를 다룬다. 사용자 catalog는 사용할 수 있는 server와 tool을 탐색하는 화면이며, 서버 등록/enable/disable/publish/unpublish/quarantine 같은 운영 제어는 `/admin/servers`에서 다룬다.

!!! note "현재 UI 범위"
    사용자 화면은 catalog browsing과 read-only detail에 초점을 둔다. 서버 등록, rollout, quarantine 같은 조작은 관리자 guide와 기존 [Control Plane API](../API.md)를 기준으로 확인한다.

## `k8s-readonly` 예시

로컬 seed data에는 다음 server가 포함된다.

| 항목 | 값 |
| --- | --- |
| Server slug | `k8s-readonly` |
| Server ID | `00000000-0000-4000-8000-000000000102` |
| Transport | `streamable_http` |
| Gateway URL | `http://localhost:5000/mcp/k8s-readonly` |
| Granted tools | `list_namespaces`, `list_pods`, `get_pod` |

Gateway에서 tool 목록을 확인할 수 있다.

```bash
curl http://localhost:5000/mcp/k8s-readonly \
  -H 'authorization: Bearer dev-admin-token' \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Catalog가 비어 있을 때

`/user/catalog`가 비어 있으면 다음을 확인한다.

1. API가 떠 있는지 확인한다: `curl http://localhost:4000/healthz`
2. seed server가 반환되는지 확인한다: `curl http://localhost:4000/api/servers`
3. local runtime state가 꼬였으면 `pnpm dev:reset-db`를 실행하거나 `MCP_STORE_PATH` 파일을 제거한다.
