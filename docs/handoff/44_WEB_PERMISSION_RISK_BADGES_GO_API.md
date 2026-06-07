# 44. WEB_PERMISSION_RISK_BADGES_GO_API Handoff

## Changed Files

- `apps/web/components/tables.tsx`
- `apps/web/components/tool-test-lab.tsx`
- `apps/web/app/operations/page.tsx`
- `apps/web/app/servers/[serverId]/page.tsx`

## Contract/Schema Changes

- None.
- Standard `StatusPill` usage now covers risk, grant state, disabled, quarantined, health, rollout status, and policy dry-run decisions.

## DB Migration

- None.

## Test Results

- Added tests for grant-state and quarantine rendering.
- Browser QA verified policy decision badges and quarantine status badges.

## Remaining TODO

- Add a dedicated shared badge component only if badge rules become more complex than current `StatusPill` tone mapping.

## Conflict Notes

- No shared contract files changed.
