#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATUS=0

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

run_check "dependency and filesystem scan" "${ROOT_DIR}/scripts/security/scan-deps.sh"
run_check "Go/Web/Python supply-chain scan" "${ROOT_DIR}/scripts/security/scan-supply-chain.sh"
run_check "container image and Dockerfile scan" "${ROOT_DIR}/scripts/security/scan-images.sh"
run_check "SBOM generation and image signing evidence" "${ROOT_DIR}/scripts/security/sbom-sign-images.sh"
run_check "secret scan" "${ROOT_DIR}/scripts/security/scan-secrets.sh"
run_check "Kubernetes manifest hardening scan" "${ROOT_DIR}/scripts/security/scan-k8s-manifests.sh"
run_check "MCP manifest risk review" go run ./scripts/security/check-mcp-manifest.go

exit "${STATUS}"
