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

mark_failure() {
  if [ "${STRICT}" = "1" ]; then
    STATUS=1
  fi
}

scan_image() {
  local image="$1"
  if command -v trivy >/dev/null 2>&1; then
    echo "==> trivy image vulnerability scan: ${image}"
    trivy image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 "${image}" || STATUS=1
  else
    fail_or_skip "trivy"
  fi

  if command -v grype >/dev/null 2>&1; then
    echo "==> grype image vulnerability scan: ${image}"
    grype "${image}" --fail-on high --only-fixed || STATUS=1
  else
    fail_or_skip "grype"
  fi

  if command -v cosign >/dev/null 2>&1; then
    if [ -n "${COSIGN_KEY:-}" ]; then
      echo "==> cosign image signature verification with COSIGN_KEY: ${image}"
      cosign verify --key "${COSIGN_KEY}" "${image}" || STATUS=1
    elif [ -n "${COSIGN_CERTIFICATE_IDENTITY:-}" ] && [ -n "${COSIGN_CERTIFICATE_OIDC_ISSUER:-}" ]; then
      echo "==> cosign keyless image signature verification: ${image}"
      cosign verify \
        --certificate-identity "${COSIGN_CERTIFICATE_IDENTITY}" \
        --certificate-oidc-issuer "${COSIGN_CERTIFICATE_OIDC_ISSUER}" \
        "${image}" || STATUS=1
    else
      echo "SKIP: cosign policy not configured; set COSIGN_KEY or COSIGN_CERTIFICATE_IDENTITY and COSIGN_CERTIFICATE_OIDC_ISSUER"
      mark_failure
    fi
  else
    fail_or_skip "cosign"
  fi
}

check_dockerfile() {
  local dockerfile="$1"
  echo "==> Dockerfile hardening check: ${dockerfile#${ROOT_DIR}/}"

  local from_found=0
  local runtime_user=""
  while IFS= read -r dockerfile_line; do
    if [[ "${dockerfile_line}" =~ ^[[:space:]]*[Ff][Rr][Oo][Mm][[:space:]]+(.+) ]]; then
      from_found=1
      runtime_user=""
      local from_args="${BASH_REMATCH[1]}"
      local image_ref=""
      local word
      for word in ${from_args}; do
        if [[ "${word}" == --* ]]; then
          continue
        fi
        image_ref="${word}"
        break
      done
      if [ -n "${image_ref}" ] && [ "${image_ref}" != "scratch" ] && [[ "${image_ref}" != *@sha256:* ]]; then
        echo "REVIEW: ${dockerfile#${ROOT_DIR}/} base image is not digest-pinned: ${image_ref}"
        mark_failure
      fi
    elif [[ "${dockerfile_line}" =~ ^[[:space:]]*[Uu][Ss][Ee][Rr][[:space:]]+([^[:space:]]+) ]]; then
      runtime_user="${BASH_REMATCH[1]}"
    fi
  done < "${dockerfile}"
  if [ "${from_found}" -eq 0 ]; then
    echo "REVIEW: ${dockerfile#${ROOT_DIR}/} does not declare a FROM image"
    mark_failure
  fi
  if [ -z "${runtime_user}" ]; then
    echo "REVIEW: ${dockerfile#${ROOT_DIR}/} does not declare a non-root USER"
    mark_failure
  elif [ "${runtime_user}" = "root" ] || [ "${runtime_user}" = "0" ] || [[ "${runtime_user}" == root:* ]] || [[ "${runtime_user}" == 0:* ]]; then
    echo "REVIEW: ${dockerfile#${ROOT_DIR}/} declares a root runtime USER: ${runtime_user}"
    mark_failure
  fi
  if grep -Eq 'curl .+\| *(sh|bash)|wget .+\| *(sh|bash)' "${dockerfile}"; then
    echo "REVIEW: ${dockerfile#${ROOT_DIR}/} pipes downloaded content to a shell"
    mark_failure
  fi
  if grep -Eq 'apt-get install|apk add|yum install' "${dockerfile}" && ! grep -Eq 'rm -rf /var/lib/apt/lists|--no-cache' "${dockerfile}"; then
    echo "REVIEW: ${dockerfile#${ROOT_DIR}/} installs packages without an obvious cache cleanup/no-cache flag"
    mark_failure
  fi
}

cd "${ROOT_DIR}" || exit 1

echo "Scanning container image vulnerability and Dockerfile hardening targets"

if [ -n "${SECURITY_IMAGES:-}" ]; then
  IFS=',' read -r -a IMAGES <<< "${SECURITY_IMAGES}"
  for image in "${IMAGES[@]}"; do
    if [ -n "${image}" ]; then
      scan_image "${image}"
    fi
  done
else
  echo "SKIP: no container images supplied; set SECURITY_IMAGES=image1,image2 to scan image vulnerabilities"
  for tool in trivy grype cosign; do
    if ! command -v "${tool}" >/dev/null 2>&1; then
      fail_or_skip "${tool}"
    fi
  done
fi

while IFS= read -r -d '' dockerfile; do
  check_dockerfile "${dockerfile}"
done < <(find "${ROOT_DIR}" -path "${ROOT_DIR}/node_modules" -prune -o -path "${ROOT_DIR}/.git" -prune -o -name Dockerfile -print0)

exit "${STATUS}"
