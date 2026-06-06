# 13. Local Development Environment 구성

MCP Hub를 로컬에서 쉽게 실행하고 테스트할 수 있는 개발 환경을 구성한다.

## 입력 전제

기존 monorepo 결과물을 기준으로 작업한다.

## 작업 목표

로컬 개발자가 다음을 한 번에 실행할 수 있게 한다.

```bash
pnpm install
pnpm dev:infra
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## docker compose

`compose.yaml` 또는 `docker-compose.yaml`을 만든다.

필수 서비스:

- postgres
- redis
- keycloak 또는 mock-oidc provider
- optional otel collector

초기 구현이 복잡하면 Keycloak 대신 mock OIDC provider를 두고, Keycloak profile은 별도로 제공한다.

## Local ports

```txt
web:     http://localhost:3000
api:     http://localhost:4000
gateway: http://localhost:5000
worker:  local process
postgres: localhost:5432
redis:    localhost:6379
keycloak/mock-oidc: localhost:8080
```

## 개발 스크립트

`scripts/dev` 아래에 다음을 제공한다.

```txt
up-infra.sh
down-infra.sh
reset-db.sh
seed.sh
smoke-test.sh
create-mock-token.sh
```

## Smoke test

다음을 검증하는 smoke test를 만든다.

1. API health OK
2. Gateway health OK
3. seed server catalog 조회 가능
4. echo server tools/list 가능
5. 허용된 echo tool call 성공
6. 권한 없는 tool call 실패
7. audit event 생성 확인

## README 요구사항

루트 README 또는 `docs/LOCAL_DEV.md`에 다음을 작성한다.

- prerequisites
- install
- infra up
- migration
- seed
- app start
- smoke test
- common troubleshooting

## 완료 조건

- 로컬에서 infra 실행 가능
- migration/seed 가능
- web/api/gateway/worker 실행 가능
- smoke test script 가능
- docs/LOCAL_DEV.md 작성
