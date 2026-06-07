# 53 MCP Server Manifest Format Go Contract Handoff

- 변경 파일: `schemas/jsonschema/mcp-server.schema.json`, `schemas/catalog/mcp-server-manifest.schema.json`, `schemas/openapi/mcp-hub.openapi.yaml`, `scripts/security/check-mcp-manifest.go`, first-party manifests.
- Contract/schema 변경: canonical runtime manifest fields added across both schema copies; OpenAPI runtime paths added.
- DB migration 여부: 없음.
- 테스트 결과: `scripts/ci/schemas.sh` pass; manifest checker passes with review warnings only.
- 남은 TODO: schema generation still performs parse/presence checks, not full JSON Schema validation of every manifest.
- 충돌 가능성: Lane B/C generated clients may need runtime path types if they consume new API fields.
