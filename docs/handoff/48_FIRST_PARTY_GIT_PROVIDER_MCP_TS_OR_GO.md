# 48 First Party Git Provider MCP Handoff

- 변경 파일: `servers/github`, `servers/gitlab`, `docs/MCP_SERVER_LANGUAGE_MATRIX.md`.
- Contract/schema 변경: provider manifests use reference-only token bindings, egress host allowlists, and policy tags.
- DB migration 여부: 없음.
- 테스트 결과: GitHub/GitLab smoke tests pass under `go test ./...`; manifest security check passes with review warnings.
- 남은 TODO: real provider API calls are not wired; current servers expose scoped read-only mock provider surfaces.
- 충돌 가능성: Lane F may tune dangerous keyword warnings for token/merge review labels.
