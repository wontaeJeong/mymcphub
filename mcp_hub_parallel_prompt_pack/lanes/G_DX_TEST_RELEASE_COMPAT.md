# Lane G - DX/Tests/Release/Compatibility

개발환경, 계약/E2E/부하 테스트, 릴리즈, 문서, 호환성 매트릭스를 구현한다.

## 병렬 작업 위치

권장 worktree:

```bash
git worktree add ../mcp-hub-g_dx_test_release_compat -b lane/g_dx_test_release_compat
cd ../mcp-hub-g_dx_test_release_compat
```

## 주요 소유 경로

- `tests/**`
- `scripts/**`
- `docs/**`
- `examples/**`
- `.github/workflows/**`

## 가급적 건드리지 말 경로

- `apps/gateway/**`
- `packages/db/**`

## 이 lane의 프롬프트

- `70_LOCAL_DEV_SEED_DATA.md` - Local Dev Seed Data
- `71_CONTRACT_TESTS.md` - Contract Tests
- `72_E2E_MCP_CLIENT_TESTS.md` - End-to-end MCP Client Tests
- `73_LOAD_SOAK_TESTS.md` - Load and Soak Tests
- `74_UPGRADE_MIGRATION_TESTS.md` - Upgrade and Migration Tests
- `75_RELEASE_NOTES_CHANGELOG_GENERATOR.md` - Release Notes and Changelog Generator
- `76_DEVELOPER_DOCS.md` - Developer Documentation
- `77_SDK_EXAMPLES.md` - SDK Examples
- `78_FIXTURE_MOCKING_FRAMEWORK.md` - Fixture and Mocking Framework
- `79_MULTI_CLIENT_COMPAT_MATRIX.md` - Multi-client Compatibility Matrix
- `80_WORKTREE_PARALLEL_MERGE_GUIDE.md` - Worktree Parallel Merge Guide

## 병렬 merge 주의사항

- shared DB schema 변경은 Lane B가 최종 소유한다.
- UI가 필요한 API가 아직 없으면 mock client 또는 MSW/fake API를 만든다.
- Gateway가 필요한 policy source가 아직 없으면 in-memory adapter를 만든다.
- Runtime/Worker가 필요한 catalog source가 아직 없으면 fixture manifest를 만든다.
- 완료 후 `docs/handoffs/g_dx_test_release_compat.md`를 작성한다.
