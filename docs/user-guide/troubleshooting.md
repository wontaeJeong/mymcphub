# Troubleshooting

이 문서는 로컬 MCP Hub 데모를 실행하는 일반 사용자와 개발자가 자주 만나는 문제를 해결하기 위한 안내다.

## 빠른 진단

| 증상 | 확인 |
| --- | --- |
| API 응답 없음 | `curl http://localhost:4000/healthz` |
| Catalog 비어 있음 | `curl http://localhost:4000/api/servers` |
| Gateway 401/403 | bearer token, grant, server status 확인 |
| Web login 반복 | `mcp_hub_session` cookie 삭제 또는 logout |
| 상태가 이상함 | `pnpm dev:reset-db` 또는 `MCP_STORE_PATH` 파일 제거 |

## `pnpm dev:infra` 실패

`pnpm dev:infra`는 `compose.yaml`의 support services를 시작한다.

| 서비스 | 기본 포트 |
| --- | --- |
| Postgres | `127.0.0.1:5432` |
| Redis | `127.0.0.1:6379` |
| Keycloak | `127.0.0.1:8080` |

포트 충돌이 있으면 기존 로컬 Postgres/Redis/Keycloak 또는 다른 Compose stack을 중지한다. support services를 내릴 때는 다음을 사용한다.

```bash
pnpm dev:infra:down
```

## `pnpm dev` 후 Web/API 연결 실패

`.env`가 `.env.example`에서 복사되었는지 확인한다.

```bash
cp .env.example .env
```

기본 URL은 다음과 같아야 한다.

| 변수 | 로컬 기본값 |
| --- | --- |
| `MCP_API_URL` | `http://localhost:4000` |
| `MCP_GATEWAY_URL` | `http://localhost:5000` |
| `MCP_HUB_PUBLIC_URL` | `http://localhost:3000` |

API health를 먼저 확인한다.

```bash
curl http://localhost:4000/healthz
curl http://localhost:4000/readyz
```

## `/login` redirect 또는 stale cookie

브라우저 세션이 오래되었으면 logout form을 제출하거나 `mcp_hub_session` cookie를 삭제한 뒤 `http://localhost:3000/login`에서 다시 시작한다.

`MCP_WEB_SESSION_SECRET` 또는 cookie 이름을 바꾼 뒤에는 기존 cookie가 더 이상 유효하지 않을 수 있다.

## `/admin` forbidden

`/admin/*` route는 platform admin 세션이 필요하다. 일반 dev user로 로그인하면 forbidden page가 정상 동작이다. 로컬 데모에서는 admin persona로 다시 로그인하거나 세션 cookie를 삭제한 뒤 admin flow를 선택한다.

## Catalog가 비어 있음

1. API catalog를 직접 확인한다.

   ```bash
   curl http://localhost:4000/api/servers
   ```

2. `k8s-readonly`가 없거나 예상과 다르면 runtime store를 reset한다.

   ```bash
   pnpm dev:reset-db
   ```

3. 그래도 꼬이면 `.env`의 `MCP_STORE_PATH`가 가리키는 파일을 제거하고 `pnpm dev`를 다시 시작한다.

!!! note "Local store"
    기본 `MCP_STORE_PATH`는 `/tmp/mcp-hub/store.json`이다. 이 파일은 local runtime catalog/audit/health state를 위한 것이며 운영 DB가 아니다.

## Gateway 401/403

로컬 데모 요청은 bearer token과 JSON content type을 포함해야 한다.

```bash
curl http://localhost:5000/mcp/k8s-readonly \
  -H 'authorization: Bearer dev-admin-token' \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

401/403이 계속되면 다음을 확인한다.

- token이 `dev-admin-token` 또는 로컬 mock token인지
- `MCP_AUTH_MODE`가 로컬 데모에 맞는지
- server가 disabled/quarantined 상태가 아닌지
- grant되지 않은 tool을 호출하고 있지 않은지

## Reset/stop 명령

```bash
pnpm dev:reset-db
pnpm dev:infra:down
```

`pnpm dev:reset-db`는 local runtime state를 reset한다. PostgreSQL schema migration을 직접 실행하는 운영 명령이 아니다.
