## Prompt 2: Data exposure matrix and shared display rules

```text
CONTEXT: User and admin summary screens currently expose IDs, owner team IDs, schema JSON, trace IDs, hashes, upstream URLs, image refs, and raw metadata too early.

TARGET ROUTES/FILES: apps/web/components/tables.tsx, apps/web/components/format.ts, table callers in user/admin routes.

UX GOAL: Create role-aware display rules so users see task-focused information while admins can still inspect technical details intentionally.

NON-GOALS: Do not remove admin access to operational data. Do not change API response shapes.

REQUIRED CHANGES:
- Define a field exposure matrix: user-visible, admin-summary, admin-detail, debug-only/hidden.
- Add minimal audience/variant props to shared table components.
- Hide or collapse IDs, hashes, trace IDs, schema JSON, ownerTeamId, upstream URL, and image refs by default outside admin-detail contexts.
- Preserve copy/detail affordances for admin-detail where necessary.

ACCEPTANCE CRITERIA:
- `/user/catalog`, `/user`, `/user/servers/[serverId]` prioritize name, state, risk, access, and next action.
- `/admin/audit` and `/admin/servers/[serverId]` keep detail inspection available behind disclosure.
- Mobile views are not just wide horizontal-scroll tables for the main user flows.

VALIDATION:
- pnpm --filter @mcp-hub/web typecheck
- pnpm --filter @mcp-hub/web test:unit
- lsp_diagnostics on changed files
- Manual Web QA for `/user/catalog`, `/user/servers/[serverId]`, `/admin/audit`, `/admin/servers/[serverId]`
```

