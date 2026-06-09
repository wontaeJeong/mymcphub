# Web UI/UX OpenCode Prompts

Original task: 전체 Web UI를 샅샅히 살펴보고 UI/UX 개선점을 모두 파악한 뒤, 수정 작업을 순차적인 OpenCode용 작업 프롬프트 여러 개로 작성한다. 한글 Web 페이지에 맞는 폰트/UI, 과도한 정보 노출, 과도한 설정 기능, 폰트 크기/위치/배치를 포함한다.

Covered route surfaces: `/`, `/login`, `/forbidden`, `/user`, `/user/catalog`, `/user/access`, `/user/client-config`, `/user/servers/[serverId]`, `/admin`, `/admin/servers`, `/admin/servers/[serverId]`, `/admin/approvals`, `/admin/audit`, `/admin/operations`, `/admin/emergency`, plus flat redirects `/catalog`, `/access`, `/client-config`, `/approvals`, `/audit`, `/operations`, `/tools`, `/servers/[serverId]`.

Use these prompts sequentially. Each prompt intentionally limits scope so OpenCode can implement, verify, and manually QA one UI/UX improvement wave at a time.

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

## Prompt 4: User home, catalog, and server detail simplification

```text
CONTEXT: User pages show operator-style metadata and dense tables that make self-service discovery harder.

TARGET ROUTES/FILES: apps/web/app/user/page.tsx, apps/web/app/catalog/content.tsx, apps/web/app/user/servers/[serverId]/page.tsx, shared table components.

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

## Prompt 6: Admin server management, detail, and registration

```text
CONTEXT: Admin server screens combine catalog, registration, raw manifest/schema fields, enable/disable controls, versions, audit, tools, resources, and prompts in dense pages.

TARGET ROUTES/FILES: apps/web/app/catalog/content.tsx, apps/web/components/server-registration-form.tsx, apps/web/app/servers/[serverId]/content.tsx.

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

## Prompt 10: Emergency controls danger zone

```text
CONTEXT: `/admin/emergency` displays emergency deny, server disable, tool disable, grant revocation, and unavailable disable controls with similar visual weight.

TARGET ROUTES/FILES: apps/web/app/admin/emergency/page.tsx, apps/web/components/admin-controls.tsx.

UX GOAL: Establish a clear danger hierarchy and safer confirmation flow for emergency actions.

NON-GOALS: Do not add missing disable-emergency endpoint behavior. Do not change server action contracts unless necessary for UX validation.

REQUIRED CHANGES:
- Make emergency deny the top incident action.
- Group server disable, tool disable, and server grant revocation into a separate danger zone.
- Require explicit confirmation with target name and reason for destructive actions where possible.
- Demote unavailable emergency-disable card to secondary explanatory text.
- Remove implementation leak phrases such as prompt scope references.

ACCEPTANCE CRITERIA:
- `/admin/emergency` clearly communicates blast radius and action severity.
- Confirmation controls are usable on mobile and not visually adjacent to unrelated actions.

VALIDATION:
- pnpm --filter @mcp-hub/web typecheck
- pnpm --filter @mcp-hub/web test:unit
- lsp_diagnostics on changed files
- Manual Web QA for `/admin/emergency`, all destructive action forms
```

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
