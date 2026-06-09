#!/usr/bin/env sh
set -eu
helm template mcp-hub deploy/helm/mcp-hub >/dev/null
