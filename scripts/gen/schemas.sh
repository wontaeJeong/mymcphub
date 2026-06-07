#!/usr/bin/env bash
set -euo pipefail

required=(
  schemas/jsonschema/mcp-server.schema.json
  schemas/jsonschema/policy.schema.json
  schemas/jsonschema/policy-as-code.schema.json
  schemas/jsonschema/audit-event.schema.json
  schemas/jsonschema/grant-request.schema.json
  schemas/jsonschema/client-profile.schema.json
)

for schema in "${required[@]}"; do
  test -s "$schema"
done

node -e 'const fs = require("node:fs"); for (const file of process.argv.slice(1)) JSON.parse(fs.readFileSync(file, "utf8"));' "${required[@]}" schemas/catalog/mcp-server-manifest.schema.json

if [ "${1:-}" != "--check" ]; then
  echo "JSON Schemas are present."
fi
