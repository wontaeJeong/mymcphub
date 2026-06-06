# Lane D - Runtime/Servers/Adapters

관리형 MCP 서버 실행, stdio adapter, first-party MCP 서버, runtime isolation을 구현한다.

## 병렬 작업 위치

권장 worktree:

```bash
git worktree add ../mcp-hub-d_runtime_servers_adapters -b lane/d_runtime_servers_adapters
cd ../mcp-hub-d_runtime_servers_adapters
```

## 주요 소유 경로

- `servers/**`
- `apps/worker/**`
- `packages/runtime/**`
- `deploy/runtime-snippets/**`

## 가급적 건드리지 말 경로

- `apps/web/**`
- `apps/api/**`
- `packages/db/**`

## 이 lane의 프롬프트

- `45_MANAGED_MCP_RUNTIME_CONTROLLER.md` - Managed MCP Runtime Controller
- `46_STDIO_ADAPTER_POD_SCAFFOLD.md` - Stdio Adapter Pod Scaffold
- `47_FIRST_PARTY_K8S_READONLY_MCP.md` - First-party Kubernetes Read-only MCP Server
- `48_FIRST_PARTY_GIT_PROVIDER_MCP.md` - First-party Git Provider MCP Server
- `49_FIRST_PARTY_INTERNAL_DOCS_MCP.md` - First-party Internal Docs MCP Server
- `50_SECRET_BROKER_RUNTIME_INJECTION.md` - Secret Broker Runtime Injection
- `51_EGRESS_POLICY_GENERATOR.md` - Egress Policy Generator
- `52_RUNTIME_SANDBOX_PROFILES.md` - Runtime Sandbox Profiles
- `53_MCP_SERVER_MANIFEST_FORMAT.md` - MCP Server Manifest Format

## 병렬 merge 주의사항

- shared DB schema 변경은 Lane B가 최종 소유한다.
- UI가 필요한 API가 아직 없으면 mock client 또는 MSW/fake API를 만든다.
- Gateway가 필요한 policy source가 아직 없으면 in-memory adapter를 만든다.
- Runtime/Worker가 필요한 catalog source가 아직 없으면 fixture manifest를 만든다.
- 완료 후 `docs/handoffs/d_runtime_servers_adapters.md`를 작성한다.
