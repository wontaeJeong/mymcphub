#!/usr/bin/env sh
set -eu
helm lint deploy/helm/mcp-hub
helm template mcp-hub deploy/helm/mcp-hub >/dev/null
