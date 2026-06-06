# 14. Release, Versioning, Rollout/Rollback 구현

MCP Hub와 MCP server의 버전 관리 및 rollout/rollback 구조를 구현한다.

## 입력 전제

기존 monorepo, DB model, Helm/GitOps 결과물을 기준으로 작업한다.

## 작업 목표

MCP server와 tool schema의 변경을 추적하고, 안전하게 rollout/rollback할 수 있는 구조를 만든다.

## Versioning 대상

- app version
- container image tag/digest
- mcp server version
- tool schema version
- policy version
- config version
- Helm chart version

## DB/metadata 요구사항

`mcp_server_versions`에 다음 정보를 저장한다.

```txt
server_id
version
image_repository
image_tag
image_digest
config_hash
tool_schema_hash
status: draft/pending/active/deprecated/rolled_back
created_by
created_at
activated_at
```

## Schema diff 요구사항

Worker는 tools/list scan 결과를 이전 버전과 비교한다.

Diff 유형:

```txt
tool_added
tool_removed
tool_description_changed
tool_input_schema_changed
tool_risk_changed
```

고위험 변경 감지 시 자동 active 전환하지 않고 approval required 상태로 둔다.

## Rollout 요구사항

- dev -> stg -> prod promotion 흐름을 문서화한다.
- Helm values에서 image tag/digest를 분리한다.
- canary placeholder를 둔다.
- rollback 절차를 문서화한다.

## API/UI 요구사항

가능하면 다음 API 또는 placeholder를 추가한다.

```txt
GET  /api/servers/:serverId/versions
POST /api/servers/:serverId/versions
POST /api/servers/:serverId/versions/:versionId/activate
POST /api/servers/:serverId/versions/:versionId/rollback
GET  /api/servers/:serverId/schema-diff
```

UI에는 최소 version list와 active version 표시를 추가한다.

## 완료 조건

- server version model 구현
- worker schema diff 구현 또는 명확한 placeholder
- API endpoint 추가
- Helm values에 image digest 고려
- docs/RELEASE.md 작성
