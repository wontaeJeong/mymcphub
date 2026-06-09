## Prompt 9: Admin home and operations dashboard density

```text
CONTEXT: `/admin` and `/admin/operations` show many metrics and tables with weak visual priority for what needs immediate action.

TARGET ROUTES/FILES: apps/web/app/admin/page.tsx, apps/web/app/operations/content.tsx, HealthTable, RolloutStatusTable, ServerTable usages.

UX GOAL: Make admin home a clear route hub and operations a prioritized incident/health dashboard.

NON-GOALS: Do not change analytics, server health, or version APIs.

REQUIRED CHANGES:
- Reduce `/admin` card copy and clarify route hierarchy: servers, approvals, audit, operations, emergency.
- Group or reduce `/admin/operations` metric cards so incidents/health/denied calls come first.
- Move usage, rollout, and operational catalog tables into collapsible or secondary sections.
- Apply admin-summary data exposure rules.

ACCEPTANCE CRITERIA:
- `/admin` scans as a concise admin hub.
- `/admin/operations` shows the most urgent operational signals first.
- Tablet/mobile layouts do not stack excessive metrics before incidents.

VALIDATION:
- pnpm --filter @mcp-hub/web typecheck
- pnpm --filter @mcp-hub/web test:unit
- lsp_diagnostics on changed files
- Manual Web QA for `/admin`, `/admin/operations`, desktop/tablet/mobile
```

