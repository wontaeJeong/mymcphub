#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STRICT="${SECURITY_STRICT:-0}"
STATUS=0
REPORT_DIR="${SECURITY_SBOM_DIR:-${ROOT_DIR}/security-reports/sbom}"

fail_or_skip() {
  local tool="$1"
  echo "SKIP: ${tool} not found"
  if [ "${STRICT}" = "1" ]; then
    STATUS=1
  fi
}

mark_failure() {
  if [ "${STRICT}" = "1" ]; then
    STATUS=1
  fi
}

safe_name() {
  printf '%s' "$1" | tr '/:@' '___'
}

cd "${ROOT_DIR}" || exit 1

if [ -z "${SECURITY_IMAGES:-}" ]; then
  echo "SKIP: no images supplied; set SECURITY_IMAGES=image1,image2 for SBOM/signing checks"
  exit 0
fi

mkdir -p "${REPORT_DIR}"
IFS=',' read -r -a IMAGES <<< "${SECURITY_IMAGES}"

for image in "${IMAGES[@]}"; do
  if [ -z "${image}" ]; then
    continue
  fi
  echo "==> supply-chain evidence for ${image}"
  if [[ "${image}" != *@sha256:* ]]; then
    echo "REVIEW: ${image} is not referenced by immutable digest"
    mark_failure
  fi

  sbom_file="${REPORT_DIR}/$(safe_name "${image}").cyclonedx.json"
  if command -v syft >/dev/null 2>&1; then
    syft "${image}" -o cyclonedx-json="${sbom_file}" || STATUS=1
  else
    fail_or_skip "syft"
  fi

  if command -v cosign >/dev/null 2>&1; then
    if [ "${SECURITY_SIGN_IMAGES:-0}" = "1" ]; then
      cosign sign --yes "${image}" || STATUS=1
    else
      echo "SKIP: image signing disabled; set SECURITY_SIGN_IMAGES=1 to sign with cosign"
    fi
    if [ "${SECURITY_ATTEST_SBOM:-0}" = "1" ] && [ -s "${sbom_file}" ]; then
      cosign attest --yes --type cyclonedx --predicate "${sbom_file}" "${image}" || STATUS=1
    else
      echo "SKIP: SBOM attestation disabled; set SECURITY_ATTEST_SBOM=1 after generating SBOMs"
    fi
  else
    fail_or_skip "cosign"
  fi
done

exit "${STATUS}"
