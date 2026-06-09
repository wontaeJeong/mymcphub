# User Guide

이 문서는 MCP Hub를 통해 MCP server를 찾고, 접근 권한을 확인하거나 요청하고, MCP client 설정을 생성하려는 일반 사용자를 위한 안내다.

로컬 데모 기준 Web console은 `http://localhost:3000`에서 열린다. 로그인 전에는 `/login`으로 이동하고, non-production 기본 dev provider를 사용하면 사용자 세션은 `/user` route tree로 들어간다.

## 무엇을 읽어야 하나

| 목적 | 문서 |
| --- | --- |
| 핵심 용어 이해 | [Concepts](concepts.md) |
| 로컬에서 직접 실행 | [Quickstart](quickstart.md) |
| 서버와 도구 탐색 | [Catalog](catalog.md) |
| 접근 요청과 현재 grant 확인 | [Access Requests](access.md) |
| MCP client 설정 생성 | [Client Config](client-config.md) |
| 로컬 실행 문제 해결 | [Troubleshooting](troubleshooting.md) |

## 로컬 데모 화면 흐름

| 단계 | Route | 확인할 것 |
| --- | --- | --- |
| 사용자 홈 | `/user` | catalog, access, client config로 이동하는 사용자용 entry |
| Catalog | `/user/catalog` | enabled server와 tool 목록 |
| Server detail | `/user/servers/[serverId]` | 서버 상세, tool, 현재 접근 상태 |
| Access | `/user/access` | 현재 표시 가능한 grant와 접근 요청 controls |
| Client config | `/user/client-config` | `opencode` 등 client snippet 생성 |

!!! note "관리자 영역"
    일반 사용자가 `/admin`에 접근하면 forbidden page가 표시된다. 승인, audit, emergency control은 [Admin Guide](../admin-guide/index.md)를 사용한다.

## 빠른 명령 요약

```bash
pnpm install
cp .env.example .env
pnpm dev:infra
pnpm dev
```

```bash
curl http://localhost:4000/healthz
curl http://localhost:4000/api/servers
```

```bash
curl http://localhost:5000/mcp/k8s-readonly \
  -H 'authorization: Bearer dev-admin-token' \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```
