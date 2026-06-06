# Lane F - Security/Supply Chain/Compliance

보안 스캔, SBOM, signing, policy-as-code, injection/SSRF/path traversal 방어를 구현한다.

## 병렬 작업 위치

권장 worktree:

```bash
git worktree add ../mcp-hub-f_security_supply_chain_compliance -b lane/f_security_supply_chain_compliance
cd ../mcp-hub-f_security_supply_chain_compliance
```

## 주요 소유 경로

- `packages/security/**`
- `.github/workflows/**`
- `deploy/policies/**`
- `docs/security/**`
- `scripts/security/**`

## 가급적 건드리지 말 경로

- `apps/web/**`
- `apps/api/**`

## 이 lane의 프롬프트

- `62_SECURITY_SCAN_CI.md` - Security Scan CI
- `63_SBOM_IMAGE_SIGNING.md` - SBOM and Image Signing
- `64_POLICY_AS_CODE_CHECKS.md` - Policy-as-code Checks
- `65_TOOL_METADATA_PROMPT_INJECTION_GUARD.md` - Tool Metadata Prompt-injection Guard
- `66_SENSITIVE_DATA_REDACTION.md` - Sensitive Data Redaction
- `67_MCP_SERVER_ATTACK_TEST_SUITE.md` - MCP Server Attack Test Suite
- `68_EMERGENCY_RESPONSE_PLAYBOOKS.md` - Emergency Response Playbooks
- `69_COMPLIANCE_EXPORT.md` - Compliance Export

## 병렬 merge 주의사항

- shared DB schema 변경은 Lane B가 최종 소유한다.
- UI가 필요한 API가 아직 없으면 mock client 또는 MSW/fake API를 만든다.
- Gateway가 필요한 policy source가 아직 없으면 in-memory adapter를 만든다.
- Runtime/Worker가 필요한 catalog source가 아직 없으면 fixture manifest를 만든다.
- 완료 후 `docs/handoffs/f_security_supply_chain_compliance.md`를 작성한다.
