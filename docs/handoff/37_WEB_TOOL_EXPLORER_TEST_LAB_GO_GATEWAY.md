# 37. WEB_TOOL_EXPLORER_TEST_LAB_GO_GATEWAY Handoff

## Changed Files

- `apps/web/app/tools/page.tsx`
- `apps/web/app/tools/page-helpers.ts`
- `apps/web/components/tool-test-lab.tsx`
- `apps/web/app/actions.ts`
- `apps/web/lib/api.ts`
- `apps/web/lib/policy-test.ts`
- `apps/web/app/action-state.ts`
- `apps/web/test/lane-c-web-contract.test.tsx`

## Contract/Schema Changes

- None.
- Web now calls existing `/api/policy/test-call` through the generated request boundary.

## DB Migration

- None.

## Test Results

- Added tests for tool test options, grant status, dry-run payload construction, and redacted display payloads.
- Browser QA submitted a dry-run payload with a token and verified the displayed result contains `DENY_BY_DEFAULT`, `[REDACTED]`, and no raw token.

## Remaining TODO

- Replace policy-only simulation with gateway-backed execution only if a safe non-dry-run admin endpoint is introduced.

## Conflict Notes

- No gateway files changed.
