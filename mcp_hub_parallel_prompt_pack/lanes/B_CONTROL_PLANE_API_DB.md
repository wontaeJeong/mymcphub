# Lane B - Control Plane API/DB

카탈로그, 권한 요청, 승인, 버전, 감사 조회를 위한 API와 DB 모델을 구현한다.

## 병렬 작업 위치

권장 worktree:

```bash
git worktree add ../mcp-hub-b_control_plane_api_db -b lane/b_control_plane_api_db
cd ../mcp-hub-b_control_plane_api_db
```

## 주요 소유 경로

- `apps/api/**`
- `packages/db/**`
- `schemas/openapi/**`
- `schemas/proposals/**`

## 가급적 건드리지 말 경로

- `apps/web/**`
- `apps/gateway/**`
- `deploy/**`

## 이 lane의 프롬프트

- `26_CATALOG_CRUD_API.md` - Server Catalog CRUD API
- `27_SERVER_VERSION_ROLLOUT_API.md` - Server Version and Rollout API
- `28_GRANT_APPROVAL_API.md` - Grant Request and Approval API
- `29_TOOL_SCHEMA_DIFF_API_WORKER.md` - Tool Schema Snapshot and Diff API
- `30_SECRET_BINDING_API.md` - Secret Binding API
- `31_TENANCY_PROJECT_TEAM_API.md` - Project and Team Tenancy API
- `32_ADMIN_KILL_SWITCH_API.md` - Admin Kill Switch API
- `33_AUDIT_QUERY_API.md` - Audit Query API
- `34_OPENAPI_CONTRACT_GENERATION.md` - OpenAPI Contract Generation

## 병렬 merge 주의사항

- shared DB schema 변경은 Lane B가 최종 소유한다.
- UI가 필요한 API가 아직 없으면 mock client 또는 MSW/fake API를 만든다.
- Gateway가 필요한 policy source가 아직 없으면 in-memory adapter를 만든다.
- Runtime/Worker가 필요한 catalog source가 아직 없으면 fixture manifest를 만든다.
- 완료 후 `docs/handoffs/b_control_plane_api_db.md`를 작성한다.
