#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CHART_PATH="${ROOT_DIR}/deploy/helm/mcp-hub"
RELEASE_NAME="mcp-hub"
NAMESPACE="mcp-hub"
RENDERED_OUTPUT="$(mktemp)"
trap 'rm -f "${RENDERED_OUTPUT}"' EXIT

if ! command -v helm >/dev/null 2>&1; then
  echo "helm is required for pnpm helm:template" >&2
  exit 1
fi

helm lint "${CHART_PATH}"

render_and_check() {
  local values_file="$1"
  if [ -n "${values_file}" ]; then
    helm template "${RELEASE_NAME}" "${CHART_PATH}" --namespace "${NAMESPACE}" -f "${values_file}" > "${RENDERED_OUTPUT}"
  else
    helm template "${RELEASE_NAME}" "${CHART_PATH}" --namespace "${NAMESPACE}" > "${RENDERED_OUTPUT}"
  fi

  if [ ! -s "${RENDERED_OUTPUT}" ]; then
    echo "helm template produced no manifests" >&2
    exit 1
  fi

  for expected in \
    "name: mcp-hub-web" \
    "name: mcp-hub-api" \
    "name: mcp-hub-gateway" \
    "name: mcp-hub-worker" \
    "MCP_AUTH_MODE:" \
    "MCP_API_URL:" \
    "MCP_GATEWAY_URL:" \
    "MCP_STORE_PATH:" \
    "MCP_TRUSTED_PROXY_HEADER:" \
    "MCP_TRUSTED_PROXY_SECRET" \
    "MCP_WORKER_INTERVAL_SECONDS:" \
    "kubernetes.io/metadata.name: ingress-nginx" \
    "path: /api" \
    "path: /mcp"; do
    if ! grep -q "${expected}" "${RENDERED_OUTPUT}"; then
      echo "rendered manifests missing ${expected}" >&2
      exit 1
    fi
  done

  if [ -n "${values_file}" ]; then
    for expected in \
      "kind: ServiceMonitor" \
      "mcp-hub-observability.json" \
      "kubernetes.io/metadata.name: monitoring" \
      "port: 4100"; do
      if ! grep -q "${expected}" "${RENDERED_OUTPUT}"; then
        echo "rendered observability manifests missing ${expected}" >&2
        exit 1
      fi
    done
  fi

  if [ "${values_file}" != "" ] && [ "${values_file##*/}" != "values-dev.yaml" ]; then
    if ! grep -q "kind: PrometheusRule" "${RENDERED_OUTPUT}"; then
      echo "rendered alert manifests missing PrometheusRule" >&2
      exit 1
    fi
  fi
}

render_and_check ""
render_and_check "${CHART_PATH}/values-dev.yaml"
render_and_check "${CHART_PATH}/values-stg.yaml"
render_and_check "${CHART_PATH}/values-prod.yaml"

if ! command -v kustomize >/dev/null 2>&1; then
  echo "kustomize is required for GitOps render validation" >&2
  exit 1
fi

kustomize build --enable-helm "${ROOT_DIR}/deploy/gitops/overlays/dev" >/dev/null
kustomize build --enable-helm "${ROOT_DIR}/deploy/gitops/overlays/stg" >/dev/null
kustomize build --enable-helm "${ROOT_DIR}/deploy/gitops/overlays/prod" >/dev/null
