# Lane C - Web UI / TS Client for Go API Handoff

## Changed Files

- `apps/web/lib/api.ts`
- `apps/web/lib/policy-test.ts`
- `apps/web/app/action-state.ts`
- `apps/web/app/actions.ts`
- `apps/web/app/tools/page.tsx`
- `apps/web/app/tools/page-helpers.ts`
- `apps/web/components/tool-test-lab.tsx`
- `apps/web/components/client-config-form.tsx`
- `apps/web/app/operations/page.tsx`
- `apps/web/app/operations/page-helpers.ts`
- `apps/web/app/servers/[serverId]/page.tsx`
- `apps/web/app/audit/page.tsx`
- `apps/web/components/tables.tsx`
- `apps/web/app/globals.css`
- `apps/web/test/lane-c-web-contract.test.tsx`
- `docs/handoff/35_WEB_CATALOG_DASHBOARD_GO_API.md`
- `docs/handoff/36_WEB_SERVER_DETAIL_PAGE_GO_API.md`
- `docs/handoff/37_WEB_TOOL_EXPLORER_TEST_LAB_GO_GATEWAY.md`
- `docs/handoff/38_WEB_ACCESS_REQUEST_FLOW_GO_API.md`
- `docs/handoff/39_WEB_APPROVAL_INBOX_GO_API.md`
- `docs/handoff/40_WEB_AUDIT_SEARCH_UI_GO_API.md`
- `docs/handoff/41_WEB_CLIENT_CONFIG_GENERATOR_GO_API.md`
- `docs/handoff/42_WEB_SERVER_REGISTRATION_WIZARD_GO_API.md`
- `docs/handoff/43_WEB_HEALTH_ROLLOUT_PAGE_GO_API.md`
- `docs/handoff/44_WEB_PERMISSION_RISK_BADGES_GO_API.md`

## Contract And Schema Changes

- No OpenAPI or JSON Schema files changed.
- Web now consumes existing Go API routes more completely: `/api/policy/test-call`, `/api/servers/:serverId/versions`, `/api/server-health`, `/api/audit-events/export`, and `/api/client-config/generate`.
- `apps/web/lib/api.ts` type coverage was extended for server `published`/`quarantined`, policy decisions, dry-run test call input, and client profile metadata.

## DB Migration

- None.

## Test Results

- `lsp_diagnostics` clean on all changed TS/TSX/CSS files.
- `pnpm --filter @mcp-hub/web test` passed: 4 files, 12 tests.
- `pnpm --filter @mcp-hub/web typecheck` passed.
- `go test ./...` passed.
- `scripts/gen/openapi.sh --check` passed.
- `pnpm helm:template` passed.
- `make lint` passed.
- `make build` passed.
- Browser QA on `http://127.0.0.1:3010` passed for Tool Test Lab dry-run redaction, operations rollout/quarantine, server capability tabs, client config profile/test instruction, and audit export link.

## Remaining TODO

- `packages/sdk-ts` is still absent from this repo. Add it in a future contract-generation lane if a standalone SDK is required.
- Control Plane has no resources/prompts list contract. Server detail now exposes those tabs as explicit contract gaps without mock data.
- Registration health/scan trigger buttons require API/worker trigger endpoints before Web can invoke them directly.

## Cross-Lane Conflict Notes

- No shared schema or DB migration changes were made.
- Future Lane B/API changes to resources, prompts, generated client models, registration scans, or SDK generation should update the Web wrappers and handoff notes.
