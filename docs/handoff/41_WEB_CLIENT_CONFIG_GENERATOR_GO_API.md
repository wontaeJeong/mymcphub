# 41. WEB_CLIENT_CONFIG_GENERATOR_GO_API Handoff

## Changed Files

- `apps/web/components/client-config-form.tsx`
- `apps/web/app/actions.ts`
- `apps/web/lib/api.ts`
- `apps/web/app/action-state.ts`

## Contract/Schema Changes

- None.
- Web now submits an optional `profile` to existing `/api/client-config/generate` and renders client test instructions.

## DB Migration

- None.

## Test Results

- Browser QA generated an opencode config with `qa-profile` and verified the rendered `mcphubctl --profile qa-profile health` instruction.

## Remaining TODO

- Claude/Codex/VS Code formats remain placeholders from the Go API response until backend-specific config formats are finalized.

## Conflict Notes

- No API files changed.
