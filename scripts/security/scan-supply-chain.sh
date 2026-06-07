#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STRICT="${SECURITY_STRICT:-0}"
STATUS=0

fail_or_skip() {
  local tool="$1"
  echo "SKIP: ${tool} not found"
  if [ "${STRICT}" = "1" ]; then
    STATUS=1
  fi
}

run_check() {
  local label="$1"
  shift
  echo "==> ${label}"
  "$@"
  local exit_code=$?
  if [ "${exit_code}" -ne 0 ]; then
    STATUS=1
  fi
}

has_python_project() {
  find "${ROOT_DIR}" \
    -path "${ROOT_DIR}/.git" -prune -o \
    -path "${ROOT_DIR}/node_modules" -prune -o \
    \( -name 'requirements*.txt' -o -name 'pyproject.toml' -o -name 'Pipfile.lock' \) -print -quit | grep -q .
}

cd "${ROOT_DIR}" || exit 1

echo "Scanning Go, Web, Python-if-present, and filesystem supply-chain targets from ${ROOT_DIR}"

if command -v govulncheck >/dev/null 2>&1; then
  run_check "govulncheck Go vulnerability scan" govulncheck ./...
else
  fail_or_skip "govulncheck"
fi

if command -v trivy >/dev/null 2>&1; then
  run_check "trivy filesystem vulnerability and secret scan" trivy fs --scanners vuln,secret --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 --skip-dirs node_modules --skip-dirs .git .
else
  fail_or_skip "trivy"
fi

if [ -f pnpm-lock.yaml ] || [ -f package-lock.json ]; then
  if command -v pnpm >/dev/null 2>&1 && [ -f pnpm-lock.yaml ]; then
    run_check "pnpm high dependency audit" pnpm audit --audit-level high
  elif command -v npm >/dev/null 2>&1 && [ -f package-lock.json ]; then
    run_check "npm high dependency audit" npm audit --audit-level=high
  else
    fail_or_skip "pnpm or npm"
  fi
else
  echo "SKIP: no Node lockfile found"
fi

if has_python_project; then
  if command -v pip-audit >/dev/null 2>&1; then
    run_check "pip-audit Python dependency scan" pip-audit
  else
    fail_or_skip "pip-audit"
  fi
else
  echo "SKIP: no Python dependency manifests found"
fi

exit "${STATUS}"
