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

