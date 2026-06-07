# 40. WEB_AUDIT_SEARCH_UI_GO_API Handoff

## Changed Files

- `apps/web/app/audit/page.tsx`
- `apps/web/lib/api.ts`
- `apps/web/components/tables.tsx`

## Contract/Schema Changes

- None.
- Web now builds export URLs for existing `/api/audit-events/export` with active filters.
- Audit rows now include a trace search link in addition to trace copy.

## DB Migration

- None.

## Test Results

- Existing audit tests remain green.
- Browser QA verified the filtered export link includes `/api/audit-events/export` and `trace_id`.

## Remaining TODO

- None for current API-backed audit search/export UI.

## Conflict Notes

- No shared contract files changed.
