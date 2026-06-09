## Prompt 3: AppShell, login, forbidden, root and redirect surfaces

```text
CONTEXT: Navigation lacks active state, sidebar copy is wordy, the session card exposes email on every page, and redirect/login/forbidden pages expose internal terms.

TARGET ROUTES/FILES: apps/web/components/chrome.tsx, apps/web/components/theme-toggle.tsx, apps/web/app/page.tsx, apps/web/app/login/page.tsx, apps/web/app/forbidden/page.tsx, flat redirect pages under apps/web/app.

UX GOAL: Make global navigation, login, forbidden, root, and legacy redirects concise, privacy-aware, and Korean-friendly.

NON-GOALS: Do not change auth/session security logic. Do not add new providers.

REQUIRED CHANGES:
- Add active nav styling and aria-current.
- Shorten sidebar brand descriptions and reduce mobile nav height.
- Collapse or mask session email/PII unless explicitly expanded.
- Rewrite login copy so provider/OIDC/dev/env diagnostics are user-safe by default.
- Rewrite forbidden copy to explain next steps without role/group-mapping jargon.
- Verify `/`, `/catalog`, `/access`, `/client-config`, `/approvals`, `/audit`, `/operations`, `/tools`, `/servers/[serverId]` redirect without blank/meta-refresh-like UX.

ACCEPTANCE CRITERIA:
- Unauthenticated `/` goes to `/login`; dev user `/` goes to `/user`; dev admin `/` goes to `/admin`.
- Non-admin `/admin` reaches a clear forbidden page.
- Flat redirects do not show developer-stack or empty transition artifacts to users.

VALIDATION:
- pnpm --filter @mcp-hub/web typecheck
- pnpm --filter @mcp-hub/web test:unit
- lsp_diagnostics on changed files
- Manual Web QA for `/`, `/login`, `/forbidden`, all flat redirect routes, desktop/tablet/mobile
```

