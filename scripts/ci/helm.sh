#!/usr/bin/env bash
set -euo pipefail

if command -v helm >/dev/null 2>&1; then
  bash tests/helm-template.sh
else
  echo "helm not installed; skipping local Helm render check" >&2
fi
