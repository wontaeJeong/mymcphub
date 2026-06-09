## Prompt 5: User access request and client config simplification

```text
CONTEXT: `/user/access` asks for raw subject/project IDs, comma-separated tools, requestedAction, and ISO timestamps. `/user/client-config` surfaces profile, command hints, and JSON too early.

TARGET ROUTES/FILES: apps/web/app/access/content.tsx, apps/web/components/client-config-form.tsx, related server actions only where needed to preserve existing contracts.

UX GOAL: Make user access requests and client config generation guided and understandable for Korean users.

NON-GOALS: Do not change API contracts. Do not remove admin grant creation capability.

REQUIRED CHANGES:
- In user mode, reduce access request fields to server, tool(s), environment, reason, optional expiry.
- Hide or auto-fill subjectId/requestedAction where the current contract permits.
- Replace CSV/ISO placeholders with selectors, date/time input, examples, or advanced disclosure.
- Split client config into basic generation and advanced profile/JSON/command details.

ACCEPTANCE CRITERIA:
- `/user/access` default view does not expose UUID/ISO/CSV/requestedAction jargon.
- `/user/client-config` shows config JSON only after generation and behind an intentional detail area.

VALIDATION:
- pnpm --filter @mcp-hub/web typecheck
- pnpm --filter @mcp-hub/web test:unit
- lsp_diagnostics on changed files
- Manual Web QA for `/user/access`, `/user/client-config`, mobile forms
```

