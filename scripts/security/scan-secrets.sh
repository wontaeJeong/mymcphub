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

cd "${ROOT_DIR}" || exit 1

echo "Scanning repository secret detection targets from ${ROOT_DIR}"

if command -v gitleaks >/dev/null 2>&1; then
  if gitleaks git --help >/dev/null 2>&1; then
    gitleaks git --source "${ROOT_DIR}" --redact=100 --no-banner || STATUS=1
  else
    echo "SKIP: gitleaks git subcommand not available"
    if [ "${STRICT}" = "1" ]; then
      STATUS=1
    fi
  fi
else
  fail_or_skip "gitleaks"
fi

echo "==> lightweight committed-secret pattern review"
if grep -RInE '(AWS_SECRET_ACCESS_KEY|BEGIN (RSA|OPENSSH|EC|DSA) PRIVATE KEY|PRIVATE_KEY=|SECRET=|TOKEN=|PASSWORD=)' \
  --exclude-dir=.git \
  --exclude-dir=node_modules \
  --exclude='scan-secrets.sh' \
  "${ROOT_DIR}"; then
  echo "REVIEW: potential secret-like strings found; confirm they are not plaintext secrets"
  if [ "${STRICT}" = "1" ]; then
    STATUS=1
  fi
else
  echo "OK: no lightweight secret patterns found"
fi

exit "${STATUS}"
