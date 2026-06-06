# 62. Security Scan CI

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

Lane F - Security/Supply Chain/Compliance

## 목표

container/filesystem/dependency 보안 스캔 CI를 구성한다.

## 주요 소유 경로

- `.github/workflows/security.yml`
- `scripts/security/**`
- `docs/security/**`

## 가급적 건드리지 말 경로

- `apps/web/**`
- `apps/api/**`

## 작업 지시

1. Trivy 또는 Grype를 구현하거나 보강한다.
2. severity threshold를 구현하거나 보강한다.
3. SARIF artifact를 구현하거나 보강한다.
4. allowlist를 구현하거나 보강한다.
5. local command를 구현하거나 보강한다.

## 세부 요구사항

- 기존 public API와 package boundary를 깨지 않는다.
- 구현이 큰 경우 interface와 fake adapter를 먼저 만들고 실제 provider는 후속 TODO로 분리한다.
- `any` 남발을 피하고, 입력/출력 type을 명확히 둔다.
- 보안 관련 값(token, secret, credential, kubeconfig)은 로그에 남기지 않는다.
- 실패 응답은 사람이 이해할 수 있는 reason code와 trace id를 포함한다.
- 새 설정값은 `.env.example` 또는 관련 config schema에 반영한다.
- 테스트 fixture는 재사용 가능하게 `tests/fixtures` 또는 package-local fixture로 둔다.

## 검증 기준

- PR에서 보안 스캔이 실행되고 실패 기준이 명확하다.
- 관련 unit test 또는 integration test가 추가된다.
- `pnpm lint`, `pnpm test` 또는 해당 workspace의 검증 명령이 통과한다.
- 변경된 API/설정/운영 절차는 문서 또는 handoff에 기록된다.

## 완료 후 handoff

`docs/handoffs/62_SECURITY_SCAN_CI.md` 파일을 만들고 다음을 기록한다.

```md
# 62. Security Scan CI Handoff

## 변경 요약

## 주요 파일

## 실행/검증 명령

## 남은 TODO

## 병렬 merge 시 충돌 가능 파일
```
