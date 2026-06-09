## Prompt 8: Audit logs UX

```text
CONTEXT: `/admin/audit` exposes hashes, trace IDs, masked JSON, export, pagination, and many filters at the same level.

TARGET ROUTES/FILES: apps/web/app/audit/content.tsx, apps/web/app/audit/page-helpers.ts, AuditTable, ToolCallTable.

UX GOAL: Make audit review summary-first, with advanced diagnostics available intentionally.

NON-GOALS: Do not weaken admin audit access. Do not remove export capability.

REQUIRED CHANGES:
- Keep only common filters visible; move trace/user/client/tool/server advanced filters behind disclosure.
- Collapse trace ID, argument hash, redacted argument JSON, and metadata JSON by default.
- Distinguish policy/admin events from tool-call events visually.
- Rewrite labels around incident review rather than raw API fields.

ACCEPTANCE CRITERIA:
- `/admin/audit` default view does not show raw JSON/hash/trace columns as primary content.
- Admins can still reveal and copy details when needed.

VALIDATION:
- pnpm --filter @mcp-hub/web typecheck
- pnpm --filter @mcp-hub/web test:unit
- lsp_diagnostics on changed files
- Manual Web QA for `/admin/audit`, filters, export/detail disclosure
```

