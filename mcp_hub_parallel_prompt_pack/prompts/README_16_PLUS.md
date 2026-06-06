# 16 이후 프롬프트 사용법

이 디렉터리의 16~80번 프롬프트는 00~15번 베이스 작업 이후 병렬로 진행하기 위한 고도화 작업이다.

권장 방식은 번호순 단일 실행이 아니라 lane별 병렬 실행이다.

- 16~25: Gateway/Auth/Policy
- 26~34: Control Plane API/DB
- 35~44: Web UI/Admin UX
- 45~53: Runtime/Servers/Adapters
- 54~61: Observability/Audit/Analytics
- 62~69: Security/Supply Chain/Compliance
- 70~80: DX/Tests/Release/Compatibility

먼저 repository root의 `PARALLEL_WORK_PLAN.md`와 `lanes/*.md`를 읽고, 각 shell/worktree에서 자기 lane에 해당하는 prompt만 적용한다.
