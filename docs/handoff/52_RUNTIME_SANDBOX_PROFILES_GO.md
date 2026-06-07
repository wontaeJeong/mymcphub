# 52 Runtime Sandbox Profiles Go Handoff

- 변경 파일: `internal/runtime/runtime.go`, schemas, Helm values/config, first-party manifests.
- Contract/schema 변경: manifest `sandbox` supports restricted/gvisor/kata profiles, runtimeClass, seccomp, non-root, read-only rootfs, resources.
- DB migration 여부: 없음.
- 테스트 결과: runtime renderer includes sandbox settings in rendered Deployment; Helm render passes.
- 남은 TODO: gVisor/Kata runtime classes are optional names only and are not installed by this chart.
- 충돌 가능성: Lane F may add stricter Pod Security Admission checks.
