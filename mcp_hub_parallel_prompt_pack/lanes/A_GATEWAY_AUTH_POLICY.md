# Lane A - Gateway/Auth/Policy

MCP Gateway의 인증, 세션, 라우팅, tool-level policy enforcement를 구현한다.

## 병렬 작업 위치

권장 worktree:

```bash
git worktree add ../mcp-hub-a_gateway_auth_policy -b lane/a_gateway_auth_policy
cd ../mcp-hub-a_gateway_auth_policy
```

## 주요 소유 경로

- `apps/gateway/**`
- `packages/auth/**`
- `packages/policy/**`
- `packages/protocol/**`

## 가급적 건드리지 말 경로

- `apps/web/**`
- `deploy/**`
- `packages/db/**`

## 이 lane의 프롬프트

- `16_GATEWAY_ROUTE_REGISTRY_RESOLVER.md` - Gateway Route Registry Resolver
- `17_GATEWAY_SESSION_MANAGER_STICKY_ROUTING.md` - Gateway Session Manager and Sticky Routing
- `18_GATEWAY_OIDC_RESOURCE_SERVER.md` - Gateway OIDC Resource Server Middleware
- `19_TOOL_DISCOVERY_FILTER.md` - Tool Discovery Filtering
- `20_TOOL_CALL_POLICY_INTERCEPTOR.md` - Tool Call Policy Interceptor
- `21_RATE_LIMITING_QUOTAS.md` - Rate Limiting and Quotas
- `22_UPSTREAM_CIRCUIT_BREAKER_TIMEOUTS.md` - Upstream Circuit Breaker, Timeouts, Retries
- `23_STEP_UP_AUTH_HIGH_RISK_TOOLS.md` - Step-up Authorization for High-risk Tools
- `24_MCP_CLIENT_ONBOARDING_AUTH.md` - MCP Client Onboarding Auth Model
- `25_GATEWAY_CONFIG_HOT_RELOAD.md` - Gateway Config Hot Reload

## 병렬 merge 주의사항

- shared DB schema 변경은 Lane B가 최종 소유한다.
- UI가 필요한 API가 아직 없으면 mock client 또는 MSW/fake API를 만든다.
- Gateway가 필요한 policy source가 아직 없으면 in-memory adapter를 만든다.
- Runtime/Worker가 필요한 catalog source가 아직 없으면 fixture manifest를 만든다.
- 완료 후 `docs/handoffs/a_gateway_auth_policy.md`를 작성한다.
