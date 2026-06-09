#!/usr/bin/env bash
set -euo pipefail

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$repo_root"

infra_only=false

for arg in "$@"; do
  case "$arg" in
    --)
      ;;
    --infra-only)
      infra_only=true
      ;;
    *)
      printf 'Unknown option: %s\n' "$arg" >&2
      printf 'Usage: %s [--infra-only]\n' "$0" >&2
      exit 2
      ;;
  esac
done

api_url="${MCP_API_URL:-http://localhost:4000}"
gateway_url="${MCP_GATEWAY_URL:-http://localhost:5000}"
k8s_url="${MCP_K8S_URL:-http://localhost:5102}"
oidc_url="${OIDC_ISSUER_URL:-http://localhost:8080/realms/mcp-hub}"
admin_token="dev-admin-token"

tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

pass() {
  printf 'ok - %s\n' "$1"
}

fail() {
  printf 'not ok - %s\n' "$1" >&2
  exit 1
}

request() {
  local expected_status="$1"
  local output_file="$2"
  shift 2
  local status
  status=$(curl -sS -o "$output_file" -w '%{http_code}' "$@")
  if [ "$status" != "$expected_status" ]; then
    printf 'Expected HTTP %s but got %s for curl %s\n' "$expected_status" "$status" "$*" >&2
    printf 'Response body:\n' >&2
    cat "$output_file" >&2
    printf '\n' >&2
    exit 1
  fi
}

json_assert() {
  local file="$1"
  local expression="$2"
  local description="$3"
  node -e '
const fs = require("node:fs");
const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (!Function("data", `return (${process.argv[2]});`)(data)) {
  console.error(`Assertion failed: ${process.argv[3]}`);
  console.error(JSON.stringify(data, null, 2));
  process.exit(1);
}
' "$file" "$expression" "$description"
  pass "$description"
}

check_infra() {
  require_command docker
  request 200 "$tmp_dir/oidc.json" "$oidc_url/.well-known/openid-configuration"
  json_assert "$tmp_dir/oidc.json" "data.issuer === '$oidc_url'" "OIDC issuer is reachable"
  docker compose exec -T postgres pg_isready -U mcp -d mcp_hub >/dev/null
  pass "Postgres is accepting local mcp_hub connections"
  [ "$(docker compose exec -T redis redis-cli ping | tr -d '\r')" = "PONG" ] || fail "Redis ping failed"
  pass "Redis responds to ping"
}

require_command curl
require_command node
check_infra

if [ "$infra_only" = true ]; then
  exit 0
fi

request 200 "$tmp_dir/api-health.json" "$api_url/healthz"
json_assert "$tmp_dir/api-health.json" "data.service === 'api' && data.status === 'ok'" "API healthz is ok"

request 200 "$tmp_dir/api-ready.json" "$api_url/readyz"
json_assert "$tmp_dir/api-ready.json" "data.service === 'api' && data.status === 'ready'" "API readyz is ready"

request 200 "$tmp_dir/catalog.json" "$api_url/api/servers"
json_assert "$tmp_dir/catalog.json" "Array.isArray(data.items) && data.items.some((server) => server.slug === 'k8s-readonly')" "Seeded catalog includes k8s-readonly"
json_assert "$tmp_dir/catalog.json" "data.items.some((server) => server.slug === 'k8s-readonly' && server.category === 'cloud_infra' && Array.isArray(server.tags) && server.tags.includes('kubernetes') && server.summary === 'Read Kubernetes namespaces and pods through the MCP Gateway.' && Array.isArray(server.installMethods) && server.installMethods.includes('gateway') && server.trustLevel === 'platform_supported' && server.visibility === 'published')" "Seeded catalog includes k8s-readonly market metadata"

request 200 "$tmp_dir/server-health.json" "$api_url/api/server-health"
json_assert "$tmp_dir/server-health.json" "Array.isArray(data.items) && data.items.some((check) => check.serverId === '00000000-0000-4000-8000-000000000102' && check.status === 'healthy')" "API server-health returns seeded health records"

request 200 "$tmp_dir/client-config.json" "$api_url/api/client-config/generate" \
  -H 'content-type: application/json' \
  -d '{"client":"opencode","profile":"local","serverId":"00000000-0000-4000-8000-000000000102"}'
json_assert "$tmp_dir/client-config.json" "data.client === 'opencode' && data.profile === 'local' && data.placeholder === false && data.gatewayUrl === '$gateway_url/mcp/k8s-readonly' && data.serverSlug === 'k8s-readonly' && data.auth?.type === 'bearer' && data.auth?.tokenEnv === 'MCPHUB_TOKEN' && data.config?.mcp?.['k8s-readonly']?.headers?.authorization === 'Bearer \${MCPHUB_TOKEN}'" "API client-config generate returns Gateway bearer config"

request 200 "$tmp_dir/k8s-health.json" "$k8s_url/health"
json_assert "$tmp_dir/k8s-health.json" "data.status === 'ok' && data.server === 'k8s-readonly'" "K8s upstream health is ok"

request 200 "$tmp_dir/gateway-get.json" "$gateway_url/mcp/k8s-readonly" -H "authorization: Bearer $admin_token"
json_assert "$tmp_dir/gateway-get.json" "data.server && data.server.slug === 'k8s-readonly'" "Gateway authenticated GET /mcp/k8s-readonly works"

request 401 "$tmp_dir/gateway-missing-auth.json" "$gateway_url/mcp/k8s-readonly"
json_assert "$tmp_dir/gateway-missing-auth.json" "data.error === 'missing_or_invalid_bearer_token'" "Gateway rejects missing bearer token"

request 401 "$tmp_dir/gateway-invalid-auth.json" "$gateway_url/mcp/k8s-readonly" -H "authorization: Bearer invalid-token"
json_assert "$tmp_dir/gateway-invalid-auth.json" "data.error === 'missing_or_invalid_bearer_token'" "Gateway rejects invalid bearer token"

request 200 "$tmp_dir/tools-list.json" "$gateway_url/mcp/k8s-readonly" \
  -H "authorization: Bearer $admin_token" \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
json_assert "$tmp_dir/tools-list.json" "Array.isArray(data.result?.tools) && data.result.tools.some((tool) => tool.name === 'list_namespaces')" "Gateway tools/list includes list_namespaces"

request 200 "$tmp_dir/k8s-call.json" "$gateway_url/mcp/k8s-readonly" \
  -H "authorization: Bearer $admin_token" \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_namespaces","arguments":{}}}'
json_assert "$tmp_dir/k8s-call.json" "Array.isArray(data.result?.content) && data.result.content.some((item) => item.text && item.text.includes('platform'))" "Gateway allowed list_namespaces succeeds"

request 200 "$tmp_dir/missing-tool.json" "$gateway_url/mcp/k8s-readonly" \
  -H "authorization: Bearer $admin_token" \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"missing_tool","arguments":{}}}'
json_assert "$tmp_dir/missing-tool.json" "data.error?.code === -32001" "Gateway denies missing_tool"

trace_id="local-smoke-$(date +%s)"
audit_payload=$(node -e 'console.log(JSON.stringify({eventType:"tool.call.succeeded",policyDecision:"allow",traceId:process.argv[1],serverId:"00000000-0000-4000-8000-000000000102",toolName:"list_namespaces",riskLevel:"medium",latencyMs:1,upstreamStatus:200,argumentRedactedJson:{}}))' "$trace_id")
request 201 "$tmp_dir/audit-create.json" "$api_url/api/audit-events/gateway" \
  -H 'content-type: application/json' \
  -H 'x-roles: admin' \
  -d "$audit_payload"
json_assert "$tmp_dir/audit-create.json" "data.traceId === '$trace_id' && data.eventType === 'tool.call.succeeded'" "API creates Gateway audit event"

request 200 "$tmp_dir/audit-query.json" "$api_url/api/audit-events?trace_id=$trace_id&tool=list_namespaces&event_type=tool.call.succeeded"
json_assert "$tmp_dir/audit-query.json" "Array.isArray(data.items) && data.items.some((event) => event.traceId === '$trace_id' && event.toolName === 'list_namespaces')" "API queries created Gateway audit event"
