# Client Config

이 문서는 MCP Hub Gateway를 MCP client에서 사용하기 위한 설정을 생성하려는 일반 사용자를 위한 안내다.

## Web에서 생성

`/user/client-config`는 활성 server에 대한 MCP client configuration snippet을 생성한다. 로컬 seed 기준으로 `k8s-readonly` server는 Gateway URL `http://localhost:5000/mcp/k8s-readonly`를 사용한다.

현재 문서화된 client config 예시는 `opencode`를 기준으로 한다.

!!! warning "토큰 관리"
    생성된 설정 예시는 bearer token을 직접 hard-code하지 않고 환경변수 placeholder를 사용해야 한다. 로컬 데모 외에는 `dev-admin-token`을 client 설정에 저장하지 마라.

## CLI에서 생성

```bash
go run ./apps/cli/cmd/mcphubctl --api-url http://localhost:4000 client config --client opencode --output json
```

로컬 개발에서 `--server`를 생략하면 CLI는 seed server인 `k8s-readonly`를 기본값으로 사용한다.

## Gateway 연결 확인

client 설정이 가리키는 Gateway endpoint는 다음 형태다.

```text
http://localhost:5000/mcp/{serverSlug}
```

로컬 seed server:

```bash
curl http://localhost:5000/mcp/k8s-readonly \
  -H 'authorization: Bearer dev-admin-token' \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

MCP client별 상세 호환성은 [MCP Client Compatibility](../MCP_CLIENT_COMPATIBILITY.md)와 [Client Setup](../CLIENT_SETUP.md)를 참고한다.
