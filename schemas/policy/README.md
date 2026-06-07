# Policy Schema Notes

Active policy JSON Schema contracts live in `../jsonschema/`:

- `../jsonschema/policy.schema.json` validates policy decisions.
- `../jsonschema/policy-as-code.schema.json` validates policy-as-code rules.

They are hand-authored source contracts, not generated output. Validate them from the repository root:

```sh
scripts/gen/schemas.sh --check
```
