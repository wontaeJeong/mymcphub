# 07. stdio Adapter Runtime 구현

stdio 기반 MCP server를 remote MCP Hub에서 사용할 수 있도록 adapter runtime 구조를 구현한다.

## 입력 전제

`00_CONTEXT.md`, `04_MCP_GATEWAY.md`, `06_FIRST_PARTY_MCP_SERVERS.md` 결과물을 기준으로 작업한다.

## 작업 목표

기존 stdio MCP server를 직접 Gateway process에서 실행하지 않고, 별도 adapter process/pod로 격리해서 Streamable HTTP 형태로 노출하는 구조를 만든다.

## 설계 원칙

- Gateway가 임의 subprocess를 직접 띄우지 않는다.
- stdio server는 adapter runtime 안에서만 실행한다.
- adapter는 stdin/stdout JSON-RPC 규칙을 보존한다.
- stdout에는 MCP protocol message 외 로그를 섞지 않는다.
- stderr는 structured log로 수집한다.
- timeout, restart, resource limit을 적용한다.

## 디렉토리

```txt
apps/stdio-adapter/       # 필요 시 새 app 생성
packages/mcp-protocol/    # stdio bridge utility
servers/stdio-sample/     # sample stdio server
```

기존 구조를 크게 깨지 않되, adapter app이 필요하면 추가한다.

## 기능 요구사항

1. adapter는 HTTP endpoint를 제공한다.

```txt
POST /mcp
GET  /mcp
GET  /healthz
```

2. adapter는 설정으로 stdio command를 받는다.

```env
STDIO_MCP_COMMAND=node
STDIO_MCP_ARGS=dist/server.js
STDIO_WORKDIR=/app/server
STDIO_STARTUP_TIMEOUT_MS=10000
STDIO_REQUEST_TIMEOUT_MS=30000
```

3. adapter는 MCP request를 stdio process로 전달한다.
4. process crash 시 health를 unhealthy로 바꾼다.
5. startup timeout, request timeout, max body size를 둔다.
6. concurrent request 처리 정책을 명확히 한다.
   - 초기에는 per-session serialized queue로 구현해도 된다.
7. logs는 stderr만 수집하고 stdout protocol frame은 audit log에 원문 저장하지 않는다.

## Kubernetes 운영 요구사항

- adapter는 별도 Deployment로 배포 가능해야 한다.
- 각 stdio server마다 별도 adapter deployment를 만들 수 있어야 한다.
- NetworkPolicy와 resource limit을 지원한다.
- read-only root filesystem 옵션을 Helm values로 제공한다.

## 완료 조건

- sample stdio server를 adapter로 감싸서 Gateway에서 호출 가능
- process crash 테스트 작성
- timeout 테스트 작성
- README에 운영 구조 설명
- Helm values에 stdio adapter 예시 추가
