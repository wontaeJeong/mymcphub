## Prompt 1: Korean UI foundation

```text
CONTEXT: MCP Hub Web UI is a Korean user/admin console. Current global CSS uses Latin-first display/body fonts and oversized hero/metric typography that make Korean pages hard to scan.

TARGET ROUTES/FILES: apps/web/app/globals.css, packages/ui/src/index.tsx, visible copy in apps/web/app and apps/web/components.

UX GOAL: Establish Korean-safe typography, spacing, line-height, and terminology rules before route-specific redesign work.

NON-GOALS: Do not add a new design-system library. Do not change routing, API contracts, or authentication behavior.

REQUIRED CHANGES:
- Replace Latin-first display/body stacks with Korean-safe stacks such as Pretendard, Noto Sans KR, Apple SD Gothic Neo, system-ui.
- Reduce oversized hero h1, metric values, h2, table header, form label, and status pill sizes for Korean readability.
- Remove or reduce uppercase, mono-font, and excessive letter-spacing treatment on Hangul labels, tabs, and pills.
- Add Korean-friendly line-height, word-break: keep-all, and overflow-wrap rules.
- Define a Korean glossary for provider, route, snippet, dry run, step-up, API, Control Plane, Gateway, UUID, ISO, JSON, hash, trace.

ACCEPTANCE CRITERIA:
- `/user`, `/admin`, `/user/catalog`, and `/admin/operations` do not show oversized or broken Korean titles.
- Status pills and labels are readable in Korean without Latin-console styling dominating.
- Color tokens remain compatible with existing light/dark themes.

VALIDATION:
- pnpm --filter @mcp-hub/web typecheck
- pnpm --filter @mcp-hub/web test:unit
- lsp_diagnostics on changed files
- Manual Web QA at desktop 1440, tablet 768, mobile 390 for affected routes
```

