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

cd "${ROOT_DIR}" || exit 1

echo "Scanning dependency and filesystem vulnerability targets from ${ROOT_DIR}"

if command -v trivy >/dev/null 2>&1; then
  run_check "trivy high/critical filesystem vulnerability scan" trivy fs --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 --skip-dirs node_modules --skip-dirs .git .
else
  fail_or_skip "trivy"
fi

if command -v grype >/dev/null 2>&1; then
  run_check "grype high/critical fixable dependency vulnerability scan" grype dir:. --fail-on high --only-fixed --exclude ./node_modules --exclude ./.git
else
  fail_or_skip "grype"
fi

if command -v syft >/dev/null 2>&1; then
  run_check "syft dependency SBOM inventory" syft dir:. --exclude ./node_modules --exclude ./.git -o table
else
  fail_or_skip "syft"
fi

if [ "${SECURITY_PNPM_AUDIT:-0}" = "1" ]; then
  if command -v pnpm >/dev/null 2>&1; then
    run_check "pnpm high dependency audit" pnpm audit --audit-level high
  else
    fail_or_skip "pnpm"
  fi
else
  echo "SKIP: pnpm audit disabled; set SECURITY_PNPM_AUDIT=1 to opt in"
fi

exit "${STATUS}"
