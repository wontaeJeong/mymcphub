# 46 Stdio Adapter Pod Scaffold Go Handoff

- 변경 파일: `servers/runtime-adapter/cmd/runtime-adapter/main.go`, tests, manifest.
- Contract/schema 변경: `stdio_adapter` manifest now includes runtime, sandbox, egress, and secret ref metadata.
- DB migration 여부: 없음.
- 테스트 결과: `servers/runtime-adapter/cmd/runtime-adapter` covered by `go test ./...`; Go build pass.
- 남은 TODO: long-lived multiplexed subprocess mode is not added; current adapter starts the configured command per request with timeout.
- 충돌 가능성: Gateway upstream auth behavior unchanged; direct upstream remains intended for in-cluster/Gateway use.
