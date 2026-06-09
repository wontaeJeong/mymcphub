# Quickstart

이 문서는 MCP Hub 로컬 MVP를 직접 실행해 Web, API, Gateway를 확인하려는 일반 사용자를 위한 빠른 시작 절차다.

## 1. 로컬 stack 시작

저장소 루트에서 실행한다.

```bash
pnpm install
cp .env.example .env
pnpm dev:infra
pnpm dev
```

`pnpm dev:infra`는 `compose.yaml`의 Postgres, Redis, Keycloak을 시작한다. `pnpm dev`는 Go core와 Web console을 함께 시작한다.

| 서비스 | URL |
| --- | --- |
| API | `http://localhost:4000` |
| Gateway | `http://localhost:5000` |
| Worker | `http://localhost:4100` |
| Kubernetes MCP sample server | `http://localhost:5102` |
| Web | `http://localhost:3000` |

## 2. Web 열기

브라우저에서 다음 주소를 연다.

```text
http://localhost:3000
```

예상 흐름:

1. 미인증 사용자는 `/login`으로 redirect된다.
2. 로컬 non-production 환경에서는 `dev` provider를 사용할 수 있다.
3. 일반 사용자 세션은 `/user`로 이동한다.
4. platform admin 세션은 `/admin`으로 이동한다.

## 3. API 확인

```bash
curl http://localhost:4000/healthz
curl http://localhost:4000/readyz
curl http://localhost:4000/api/servers
```

`/api/servers` 응답에는 local seed server인 `k8s-readonly`가 포함되어야 한다.

## 4. Gateway 확인

```bash
curl http://localhost:5000/mcp/k8s-readonly \
  -H 'authorization: Bearer dev-admin-token' \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

예상 결과는 `list_namespaces`, `list_pods`, `get_pod` 같은 tool이 포함된 JSON-RPC 응답이다.

인증 없이 호출하면 Gateway가 요청을 거부해야 한다.

```bash
curl http://localhost:5000/mcp/k8s-readonly
```

## 5. CLI 확인

```bash
go run ./apps/cli/cmd/mcphubctl --api-url http://localhost:4000 health
go run ./apps/cli/cmd/mcphubctl --api-url http://localhost:4000 client config --client opencode --output json
```

더 긴 데모 순서는 [MVP Demo](../MVP_DEMO.md)를 사용한다.
