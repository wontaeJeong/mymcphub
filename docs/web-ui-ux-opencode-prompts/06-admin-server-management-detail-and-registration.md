## Prompt 6: Admin server management, detail, and registration

```text
CONTEXT: Admin server screens combine catalog, registration, raw manifest/schema fields, enable/disable controls, versions, audit, tools, resources, and prompts in dense pages.

TARGET ROUTES/FILES: apps/web/app/catalog/content.tsx via apps/web/app/admin/servers/page.tsx, apps/web/components/server-registration-form.tsx, apps/web/app/servers/[serverId]/content.tsx via apps/web/app/admin/servers/[serverId]/page.tsx.

UX GOAL: Make admin server management progressive: summary first, advanced technical details second, dangerous controls clearly separated.

NON-GOALS: Do not add resources/prompts APIs. Do not change server API contracts.

REQUIRED CHANGES:
- Split server registration into basic and advanced manifest/schema sections.
- Avoid default enabled/toolEnabled being visually casual; add clear risk copy.
- Collapse admin-detail fields such as upstream URL, schema version, image refs, config hashes, tool schema hashes.
- Add stronger confirmation UX for server/tool enable-disable operations.
- Demote resources/prompts placeholder tabs into non-primary informational notes unless real data exists.

ACCEPTANCE CRITERIA:
- `/admin/servers` clearly separates catalog and registration entry points.
- `/admin/servers/[serverId]` separates risk controls from read-only diagnostic details.

VALIDATION:
- pnpm --filter @mcp-hub/web typecheck
- pnpm --filter @mcp-hub/web test:unit
- lsp_diagnostics on changed files
- Manual Web QA for `/admin/servers`, `/admin/servers/[serverId]`
```
