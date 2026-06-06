# Lane C - Web UI/Admin UX

MCP Hub 관리 UI, 카탈로그, 권한 요청, 감사 조회, client config generator를 구현한다.

## 병렬 작업 위치

권장 worktree:

```bash
git worktree add ../mcp-hub-c_web_ui -b lane/c_web_ui
cd ../mcp-hub-c_web_ui
```

## 주요 소유 경로

- `apps/web/**`
- `packages/ui/**`

## 가급적 건드리지 말 경로

- `apps/gateway/**`
- `packages/db/**`
- `deploy/**`

## 이 lane의 프롬프트

- `35_WEB_CATALOG_DASHBOARD.md` - Web Catalog Dashboard
- `36_WEB_SERVER_DETAIL_PAGE.md` - Server Detail Page
- `37_WEB_TOOL_EXPLORER_TEST_LAB.md` - Tool Explorer and Test Lab
- `38_WEB_ACCESS_REQUEST_FLOW.md` - Access Request Flow
- `39_WEB_APPROVAL_INBOX.md` - Approval Inbox
- `40_WEB_AUDIT_SEARCH_UI.md` - Audit Search UI
- `41_WEB_CLIENT_CONFIG_GENERATOR.md` - Client Config Generator UI
- `42_WEB_SERVER_REGISTRATION_WIZARD.md` - Server Registration Wizard
- `43_WEB_HEALTH_ROLLOUT_PAGE.md` - Health and Rollout Page
- `44_WEB_PERMISSION_RISK_BADGES.md` - Permission Visibility and Risk Badges

## 병렬 merge 주의사항

- shared DB schema 변경은 Lane B가 최종 소유한다.
- UI가 필요한 API가 아직 없으면 mock client 또는 MSW/fake API를 만든다.
- Gateway가 필요한 policy source가 아직 없으면 in-memory adapter를 만든다.
- Runtime/Worker가 필요한 catalog source가 아직 없으면 fixture manifest를 만든다.
- 완료 후 `docs/handoffs/c_web_ui.md`를 작성한다.
