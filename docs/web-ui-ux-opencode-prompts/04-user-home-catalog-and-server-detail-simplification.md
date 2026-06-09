## Prompt 4: User home, catalog, and server detail simplification

```text
CONTEXT: User pages show operator-style metadata and dense tables that make self-service discovery harder.

TARGET ROUTES/FILES: apps/web/app/user/page.tsx, apps/web/app/catalog/content.tsx via apps/web/app/user/catalog/page.tsx, apps/web/app/user/servers/[serverId]/page.tsx, shared table components.

UX GOAL: Turn user discovery into a task-focused flow: find server, understand risk/access, request access or generate config.

NON-GOALS: Do not change admin registration or control flows.

REQUIRED CHANGES:
- Simplify `/user` cards and reduce operational table density.
- Keep basic catalog filters visible; move advanced filters behind disclosure.
- Hide server ID, ownerTeamId, timestamps, and schema JSON by default on user server detail.
- Add clearer access-request/client-config CTAs from catalog/detail.

ACCEPTANCE CRITERIA:
- A user can browse and request access without understanding UUIDs or schema JSON.
- Mobile catalog/detail pages remain readable and action-oriented.

VALIDATION:
- pnpm --filter @mcp-hub/web typecheck
- pnpm --filter @mcp-hub/web test:unit
- lsp_diagnostics on changed files
- Manual Web QA for `/user`, `/user/catalog`, `/user/servers/[serverId]`
```
