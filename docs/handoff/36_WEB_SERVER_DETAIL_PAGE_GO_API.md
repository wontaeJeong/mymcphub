# 36. WEB_SERVER_DETAIL_PAGE_GO_API Handoff

## Changed Files

- `apps/web/app/servers/[serverId]/page.tsx`
- `apps/web/app/tools/page-helpers.ts`
- `apps/web/components/tables.tsx`
- `apps/web/app/globals.css`

## Contract/Schema Changes

- None.
- Server detail now joins existing `/api/grants` with `/api/servers/:serverId/tools` for grant status.
- Added tools/resources/prompts capability tabs; resources/prompts explicitly state the missing Control Plane contract instead of rendering mock data.

## DB Migration

- None.

## Test Results

- Existing server-detail tests still pass.
- Browser QA verified tabs, tools, resource/prompt contract-gap states, and active grant display.

## Remaining TODO

- Add live resources/prompts rows after Lane B introduces Go API endpoints for them.

## Conflict Notes

- No schema changes; future resources/prompts contracts will require Web updates.
