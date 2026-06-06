# 43. Health and Rollout Page

# 공통 전제

이 작업은 `00_CONTEXT.md`와 `01_CREATE_MONOREPO.md`~`15_DOCS_OPERATIONS.md`가 적용된 뒤 진행한다. 아직 베이스가 완성되지 않았다면, 누락된 디렉터리와 패키지는 최소 스텁으로 만들되 기존 설계와 충돌하지 않게 한다.

병렬 작업 규칙:
- 반드시 별도 branch 또는 git worktree에서 작업한다.
- 이 프롬프트에 지정된 `주요 소유 경로` 밖의 파일은 가능한 한 수정하지 않는다.
- 다른 lane과 공유되는 DB schema, OpenAPI, policy schema 변경이 필요하면 직접 대규모 수정하지 말고 `schemas/proposals/` 또는 `docs/decisions/`에 proposal을 먼저 남긴다.
- 외부 서비스 연동은 mock/fake provider를 함께 만든다.
- 모든 변경에는 테스트 또는 검증 스크립트를 추가한다.
- 작업 완료 후 `docs/handoffs/`에 변경 요약, 남은 TODO, 충돌 가능 파일을 남긴다.

## Lane

Lane C - Web UI/Admin UX

## 목표

서버별 health, version rollout, rollback 상태를 보여주는 운영 UI를 구현한다.

## 주요 소유 경로

- `apps/web/app/admin/rollouts/**`

## 가급적 건드리지 말 경로

- `apps/gateway/**`
- `packages/db/**`
- `deploy/**`

## 작업 지시

1. version table를 구현하거나 보강한다.
2. health checks를 구현하거나 보강한다.
3. canary status를 구현하거나 보강한다.
4. rollback button stub를 구현하거나 보강한다.
5. incident banner를 구현하거나 보강한다.

## 세부 요구사항

- 기존 public API와 package boundary를 깨지 않는다.
- 구현이 큰 경우 interface와 fake adapter를 먼저 만들고 실제 provider는 후속 TODO로 분리한다.
- `any` 남발을 피하고, 입력/출력 type을 명확히 둔다.
- 보안 관련 값(token, secret, credential, kubeconfig)은 로그에 남기지 않는다.
- 실패 응답은 사람이 이해할 수 있는 reason code와 trace id를 포함한다.
- 새 설정값은 `.env.example` 또는 관련 config schema에 반영한다.
- 테스트 fixture는 재사용 가능하게 `tests/fixtures` 또는 package-local fixture로 둔다.

## 검증 기준

- 운영자는 MCP server 버전과 health를 확인하고 롤백 진입점을 찾을 수 있다.
- 관련 unit test 또는 integration test가 추가된다.
- `pnpm lint`, `pnpm test` 또는 해당 workspace의 검증 명령이 통과한다.
- 변경된 API/설정/운영 절차는 문서 또는 handoff에 기록된다.

## 완료 후 handoff

`docs/handoffs/43_WEB_HEALTH_ROLLOUT_PAGE.md` 파일을 만들고 다음을 기록한다.

```md
# 43. Health and Rollout Page Handoff

## 변경 요약

## 주요 파일

## 실행/검증 명령

## 남은 TODO

## 병렬 merge 시 충돌 가능 파일
```
