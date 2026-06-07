# 45 Managed MCP Runtime Controller Go Handoff

- 변경 파일: `internal/runtime/runtime.go`, `internal/jobs/jobs.go`, `internal/db/types.go`, `internal/db/store.go`, `internal/controlplane/server.go`, Helm runtime RBAC/config templates.
- Contract/schema 변경: runtime status APIs and manifest `runtime` block added.
- DB migration 여부: 없음.
- 테스트 결과: `go test ./...`, Go build, `scripts/ci/schemas.sh`, `pnpm helm:template` pass.
- 남은 TODO: live Kubernetes apply/watch and client-go integration are intentionally not implemented in this dependency-free skeleton.
- 충돌 가능성: OpenAPI and Helm RBAC changes may intersect Lane B/E/F.
