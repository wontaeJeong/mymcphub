# 49 First Party Internal Docs MCP Handoff

- 변경 파일: `servers/internal-docs`, manifest, DLP smoke test.
- Contract/schema 변경: internal docs manifest includes runtime/egress/sandbox and read-only policy tags.
- DB migration 여부: 없음.
- 테스트 결과: DLP-redacted docs search test passes under `go test ./...`.
- 남은 TODO: external document index integration is not wired.
- 충돌 가능성: Lane F redaction policy may refine DLP keyword coverage.
