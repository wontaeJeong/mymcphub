# Container Build Files

Container build definitions live here so application and first-party MCP server source trees stay focused on runtime code. Build every image from the repository root so Dockerfile `COPY` paths continue to resolve against the monorepo layout.

```sh
docker build -f deploy/container/apps/api/Dockerfile -t mcp-hub/api:local .
docker build -f deploy/container/servers/k8s/Dockerfile -t mcp-hub/k8s-readonly:local .
```
