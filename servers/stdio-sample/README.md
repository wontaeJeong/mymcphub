# stdio Sample MCP Server

First-party stdio JSON-RPC MCP server for testing the isolated stdio adapter runtime. It reads newline-delimited JSON-RPC from stdin, writes protocol frames only to stdout, and writes diagnostic status only to stderr.

## Local Run

```sh
pnpm --filter @mcp-hub/server-stdio-sample build
node servers/stdio-sample/dist/index.js
```

## Tools

- `stdio_echo` returns the provided `message` with stdio metadata.
- `get_stdio_status` returns process id, start time, and uptime metadata.

## Direct stdio Example

```sh
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node servers/stdio-sample/dist/index.js
```

## Adapter Proxy

Run the adapter with this server as its child process:

```sh
STDIO_MCP_COMMAND=node \
STDIO_MCP_ARGS=servers/stdio-sample/dist/index.js \
STDIO_WORKDIR=. \
PORT=5103 \
pnpm --filter @mcp-hub/stdio-adapter dev
```

Then call the adapter at `http://localhost:5103/mcp` or the gateway at `http://localhost:5000/mcp/stdio-sample`.

## Docker

Build from the repository root:

```sh
docker build -f servers/stdio-sample/Dockerfile -t mcp-hub/server-stdio-sample .
docker run --rm -i mcp-hub/server-stdio-sample
```
