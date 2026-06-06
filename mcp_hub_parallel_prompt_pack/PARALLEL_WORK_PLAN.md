# MCP Hub Parallel Prompt Pack - 16 이후 작업 계획

이 패키지는 `00_CONTEXT.md`~`15_DOCS_OPERATIONS.md` 이후에 진행할 수 있는 고도화 작업을 병렬 lane으로 나눈 것이다. 번호는 16~80까지 제공하지만, 순서대로 모두 실행할 필요는 없다. 목표는 여러 shell/worktree에서 충돌을 줄이며 병렬 개발하는 것이다.

## 권장 병렬 실행 방식

```bash
# main repo에서 baseline 00~15 적용 후
git status

# lane별 worktree 생성 예시
git worktree add ../mcp-hub-lane-a -b lane/a-gateway-auth-policy
git worktree add ../mcp-hub-lane-b -b lane/b-control-plane-api-db
git worktree add ../mcp-hub-lane-c -b lane/c-web-ui
git worktree add ../mcp-hub-lane-d -b lane/d-runtime-servers
git worktree add ../mcp-hub-lane-e -b lane/e-observability
git worktree add ../mcp-hub-lane-f -b lane/f-security
git worktree add ../mcp-hub-lane-g -b lane/g-dx-test-release
```

각 shell에서는 해당 lane 파일을 먼저 읽고, lane에 포함된 prompt를 순서대로 적용한다.

## Lane 구성

| Lane | 범위 | 프롬프트 |
|---|---|---|
| A | Gateway/Auth/Policy | 16~25 |
| B | Control Plane API/DB | 26~34 |
| C | Web UI/Admin UX | 35~44 |
| D | Runtime/Servers/Adapters | 45~53 |
| E | Observability/Audit/Analytics | 54~61 |
| F | Security/Supply Chain/Compliance | 62~69 |
| G | DX/Tests/Release/Compatibility | 70~80 |

## 추천 merge 순서

1. Lane B: API/DB contract를 먼저 merge한다.
2. Lane A: Gateway가 contract에 맞춰 붙는다.
3. Lane D: Runtime/servers가 catalog/runtime contract에 맞춰 붙는다.
4. Lane E/F: 관측성/보안은 A/B/D 이후 충돌을 해소하며 merge한다.
5. Lane C: UI는 API client와 mock을 실제 API로 연결하며 merge한다.
6. Lane G: 최종 테스트, 호환성, 문서, release tooling을 merge한다.

## 병렬 충돌 회피 원칙

- DB schema와 OpenAPI는 Lane B가 최종 소유한다.
- UI는 API가 없을 때 mock API를 쓰고, DB를 직접 수정하지 않는다.
- Gateway는 DB를 직접 import하지 말고 policy/catalog provider interface를 둔다.
- Runtime은 Helm/GitOps 핵심 chart를 직접 크게 수정하지 말고 snippet/proposal을 먼저 만든다.
- Security/Observability는 공통 package를 만들되 앱별 instrumentation은 최소한의 hook으로 연결한다.

## 프롬프트 적용 예시

```bash
cd ../mcp-hub-lane-a
# opencode/codex에 prompts/16_GATEWAY_ROUTE_REGISTRY_RESOLVER.md 내용 입력
# 이어서 prompts/17_... 적용
pnpm test
```

## 산출물 확인

각 prompt 완료 후 `docs/handoffs/`에 handoff 파일을 남겨야 한다. 이 handoff를 기준으로 다른 lane이 API/계약/충돌 가능성을 파악한다.
