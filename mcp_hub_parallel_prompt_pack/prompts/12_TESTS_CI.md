# 12. Tests 및 CI 구성

MCP Hub 모노레포에 테스트 전략과 CI 파이프라인을 구성한다.

## 입력 전제

기존 구현된 monorepo 결과물을 기준으로 작업한다.

## 작업 목표

unit/integration/e2e/security smoke test를 실행할 수 있는 구조를 만든다.

## 테스트 레이어

### Unit test

대상:

- packages/policy
- packages/auth
- packages/mcp-protocol
- packages/config
- audit redaction
- schema validation

### Integration test

대상:

- apps/api endpoints
- apps/gateway tools/list filtering
- apps/gateway tools/call authorization
- apps/worker tool scan
- DB repository

### E2E smoke test

대상:

- echo MCP server 실행
- Gateway 실행
- mock auth token으로 tools/list
- allowed tool call 성공
- denied tool call 실패
- audit event 생성 확인

### Web test

대상:

- server catalog page
- server detail page
- approval queue
- audit log

## CI 요구사항

`.github/workflows/ci.yaml` 또는 내부 CI에서 참고할 수 있는 workflow 파일을 만든다.

필수 job:

```txt
install
lint
typecheck
test
build
security-smoke
helm-template
```

## Commands

root package.json에 다음 script를 정리한다.

```json
{
  "scripts": {
    "ci": "pnpm lint && pnpm typecheck && pnpm test && pnpm build",
    "test:unit": "turbo test:unit",
    "test:integration": "turbo test:integration",
    "test:e2e": "turbo test:e2e",
    "helm:template": "helm template mcp-hub deploy/helm/mcp-hub"
  }
}
```

## Test data

- deterministic seed data 사용
- test database URL 분리
- mock OIDC token helper 구현
- mock upstream MCP server helper 구현

## 완료 조건

- `pnpm ci` 또는 equivalent 명령 성공
- Gateway authorization integration test 있음
- API grant/approval integration test 있음
- policy unit test 충분함
- helm template test 있음
- CI README 작성
