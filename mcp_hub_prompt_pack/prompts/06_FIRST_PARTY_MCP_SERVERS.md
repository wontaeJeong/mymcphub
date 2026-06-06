# 06. First-party MCP Server 예시 구현

MCP Hub 모노레포 안에 first-party MCP server 예시를 구현한다.

## 입력 전제

`00_CONTEXT.md`, `01_CREATE_MONOREPO.md`, `04_MCP_GATEWAY.md` 결과물을 기준으로 작업한다.

## 작업 목표

다음 MCP server를 구현한다.

1. `servers/echo`
2. `servers/internal-docs`
3. `servers/k8s-readonly`

## 공통 요구사항

- TypeScript 기반 MCP server
- 로컬 실행 가능
- Dockerfile 제공
- health endpoint 또는 health command 제공
- tools/list 결과가 안정적으로 나오게 구현
- tool description과 input schema를 명확히 작성
- read/write/admin risk를 구분할 수 있도록 manifest 작성

## 서버별 요구사항

### servers/echo

개발/테스트용 서버다.

Tools:

```txt
echo_message
- input: { message: string }
- output: same message
- risk: low

get_server_time
- input: {}
- output: ISO timestamp
- risk: low
```

### servers/internal-docs

내부 문서 검색을 흉내내는 read-only MCP server다. 실제 외부 시스템 연동 없이 seed JSON 문서 대상으로 검색한다.

Tools:

```txt
search_docs
- input: { query: string, limit?: number }
- output: document snippets
- risk: low

read_doc
- input: { docId: string }
- output: full document body
- risk: low 또는 medium
```

### servers/k8s-readonly

Kubernetes read-only MCP server 예시다. 실제 cluster 접근은 optional로 두고, 로컬에서는 mock mode로 동작해야 한다.

Tools:

```txt
list_namespaces
- input: {}
- output: namespace list
- risk: medium

list_pods
- input: { namespace: string }
- output: pod list
- risk: medium

get_pod
- input: { namespace: string, podName: string }
- output: pod detail
- risk: medium
```

주의: delete, exec, apply 같은 write/admin tool은 구현하지 않는다.

## Manifest 요구사항

각 server는 `mcp-server.manifest.json`을 가진다.

```json
{
  "slug": "echo",
  "displayName": "Echo MCP Server",
  "description": "Development echo server",
  "transport": "streamable_http",
  "riskLevel": "low",
  "ownerTeam": "platform",
  "tools": [
    {
      "name": "echo_message",
      "riskLevel": "low",
      "readOnly": true
    }
  ]
}
```

## Gateway 연동

- seed data에 세 서버를 등록한다.
- Gateway를 통해 각 서버에 proxy 가능해야 한다.
- tools/list scan 대상이 되어야 한다.

## 완료 조건

- 세 서버 모두 로컬 실행 가능
- Docker build 가능
- Gateway 경유 tools/list 가능
- Gateway 경유 tools/call 가능
- unit test 작성
- 각 server README 작성
