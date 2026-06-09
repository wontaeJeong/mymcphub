## Prompt 7: Approval queue UX

```text
CONTEXT: `/admin/approvals` places approve and reject forms inside table cells, creating dense repeated controls and possible decision mistakes.

TARGET ROUTES/FILES: apps/web/app/approvals/content.tsx, apps/web/components/tables.tsx ApprovalTable.

UX GOAL: Make approval review a clear decision workflow with readable context and separated actions.

NON-GOALS: Do not change approval API contracts.

REQUIRED CHANGES:
- Render pending approvals as decision cards or a simpler table plus selected detail region.
- Show requester, server, requested tools, reason, ticket, expiry, and risk context clearly.
- Move approve/reject forms out of repeated table cells.
- Visually separate approve and reject flows, requiring meaningful review comment where appropriate.

ACCEPTANCE CRITERIA:
- `/admin/approvals` no longer repeats large textareas inside every table row.
- Approve/reject actions are hard to confuse and easy to review on mobile.

VALIDATION:
- pnpm --filter @mcp-hub/web typecheck
- pnpm --filter @mcp-hub/web test:unit
- lsp_diagnostics on changed files
- Manual Web QA for `/admin/approvals`
```

