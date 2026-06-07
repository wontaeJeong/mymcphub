# 47 First Party K8s Readonly MCP Go Handoff

- 변경 파일: `servers/k8s/cmd/k8s/main.go`, `servers/k8s/mcp-server.manifest.json`, tests.
- Contract/schema 변경: k8s manifest now includes policy tags, runtime, egress, and sandbox profile.
- DB migration 여부: 없음.
- 테스트 결과: namespace-scope server smoke test passes under `go test ./...`.
- 남은 TODO: real client-go cluster reader is not wired; mock namespace-scoped reader remains the local surface.
- 충돌 가능성: none outside first-party server manifest consumers.
