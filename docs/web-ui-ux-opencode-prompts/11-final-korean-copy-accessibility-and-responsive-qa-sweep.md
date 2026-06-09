## Prompt 11: Final Korean copy, accessibility, and responsive QA sweep

```text
CONTEXT: After the route-specific work, all affected pages need a final pass for Korean terminology consistency, accessibility, and responsive behavior.

TARGET ROUTES/FILES: All touched apps/web/app routes, apps/web/components/states.tsx, loading.tsx, login/forbidden pages, shared components, and tables.

UX GOAL: Ensure the complete Web UI reads like a consistent Korean product console and remains usable across desktop, tablet, and mobile.

NON-GOALS: Do not add new features. Do not change APIs, DB, schemas, auth, or gateway behavior.

REQUIRED CHANGES:
- Remove leftover mixed English/internal terms from default user-facing copy.
- Rewrite empty/error/loading states around user recovery actions, with raw errors only in admin-detail disclosure where appropriate.
- Add or fix table captions, th scope, aria-current, details labels, and invalid fake tab roles.
- Verify Korean wrapping, button placement, table/card behavior, and danger hierarchy for every primary route family.

ACCEPTANCE CRITERIA:
- `/login`, `/forbidden`, `/user/*`, `/admin/*`, and flat redirect surfaces have no unnecessary internal implementation copy by default.
- Desktop 1440, tablet 768, and mobile 390 all expose core CTAs and danger actions correctly.
- Typecheck, tests, changed-file LSP diagnostics, and manual Web QA all pass.

VALIDATION:
- pnpm --filter @mcp-hub/web typecheck
- pnpm --filter @mcp-hub/web test:unit
- lsp_diagnostics on changed files
- Live Web QA with API + Web dev for all route families
```
