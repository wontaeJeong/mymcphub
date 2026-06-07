#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STRICT="${SECURITY_STRICT:-0}"
STATUS=0
if [ "$#" -gt 0 ]; then
  TARGETS=("$@")
else
  TARGETS=("deploy")
fi
SCAN_TARGETS=("${TARGETS[@]}")
KUBE_SCORE_TARGETS=("${TARGETS[@]}")

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

cd "${ROOT_DIR}" || exit 1

echo "Scanning Kubernetes manifest hardening targets: ${TARGETS[*]}"

if command -v helm >/dev/null 2>&1; then
  RENDERED_DIR="$(mktemp -d)"
  trap 'rm -rf "${RENDERED_DIR}"' EXIT
  echo "==> rendering Helm chart to ${RENDERED_DIR}"
  if helm template mcp-hub deploy/helm/mcp-hub --namespace mcp-hub > "${RENDERED_DIR}/default.yaml" && \
    helm template mcp-hub deploy/helm/mcp-hub --namespace mcp-hub -f deploy/helm/mcp-hub/values-dev.yaml > "${RENDERED_DIR}/dev.yaml" && \
    helm template mcp-hub deploy/helm/mcp-hub --namespace mcp-hub -f deploy/helm/mcp-hub/values-stg.yaml > "${RENDERED_DIR}/stg.yaml" && \
    helm template mcp-hub deploy/helm/mcp-hub --namespace mcp-hub -f deploy/helm/mcp-hub/values-prod.yaml > "${RENDERED_DIR}/prod.yaml"; then
    SCAN_TARGETS=("${RENDERED_DIR}")
    KUBE_SCORE_TARGETS=("${RENDERED_DIR}/default.yaml" "${RENDERED_DIR}/dev.yaml" "${RENDERED_DIR}/stg.yaml" "${RENDERED_DIR}/prod.yaml")
  else
    echo "REVIEW: helm template render failed; falling back to requested targets"
    STATUS=1
  fi
else
  echo "SKIP: helm not found"
  if [ "${STRICT}" = "1" ]; then
    STATUS=1
  fi
fi

if command -v kube-linter >/dev/null 2>&1; then
  kube-linter lint "${SCAN_TARGETS[@]}" || STATUS=1
else
  fail_or_skip "kube-linter"
fi

if command -v kube-score >/dev/null 2>&1; then
  kube-score score "${KUBE_SCORE_TARGETS[@]}" || STATUS=1
else
  fail_or_skip "kube-score"
fi

if command -v trivy >/dev/null 2>&1; then
  TRIVY_EXIT_CODE=0
  if [ "${STRICT}" = "1" ]; then
    TRIVY_EXIT_CODE=1
  fi
  trivy config --severity HIGH,CRITICAL --exit-code "${TRIVY_EXIT_CODE}" "${SCAN_TARGETS[@]}" || STATUS=1
else
  fail_or_skip "trivy"
fi

echo "==> Helm and Kubernetes runtime hardening checklist"
for required in \
  'runAsNonRoot' \
  'readOnlyRootFilesystem' \
  'allowPrivilegeEscalation' \
  'capabilities' \
  'seccompProfile' \
  'resources' \
  'NetworkPolicy' \
  'automountServiceAccountToken'; do
  if grep -RIn "${required}" deploy/helm deploy/gitops >/dev/null 2>&1; then
    echo "OK: ${required} configured in deployment assets"
  else
    echo "REVIEW: ${required} not found in deployment assets"
    mark_failure
  fi
done

exit "${STATUS}"
