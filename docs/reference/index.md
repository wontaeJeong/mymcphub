# Reference

이 문서는 MCP Hub를 실행, 검증, 운영할 때 자주 확인하는 환경 변수, scripts, CLI, 용어를 찾는 사용자와 운영자를 위한 참고 문서다.

## Reference 문서

| 문서 | 내용 |
| --- | --- |
| [Environment Variables](environment-variables.md) | `.env.example` 기준 환경 변수 표 |
| [Scripts and CLI](scripts-and-cli.md) | `package.json`, `Makefile`, `scripts/*`, `mcphubctl`, docs commands |
| [Glossary](glossary.md) | MCP Hub 용어집 |
| [MCP Server Matrix](../MCP_SERVER_LANGUAGE_MATRIX.md) | first-party MCP server language matrix |
| [MCP Client Compatibility](../MCP_CLIENT_COMPATIBILITY.md) | MCP client compatibility checks |
| [Client Setup](../CLIENT_SETUP.md) | client setup examples |
| [Server Onboarding](../MCP_SERVER_ONBOARDING.md) | MCP server onboarding checklist |

!!! note "Source of truth"
    환경 변수는 `.env.example`, 명령은 `package.json`과 `Makefile`, CI는 `.github/workflows/ci.yaml`을 우선한다.
