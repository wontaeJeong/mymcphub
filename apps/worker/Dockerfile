FROM golang:1.26.4-alpine AS build
WORKDIR /src
COPY go.mod go.work ./
COPY internal ./internal
COPY apps/worker ./apps/worker
RUN go build -o /out/worker ./apps/worker/cmd/worker

FROM alpine:3.20
RUN adduser -D -u 10001 appuser
COPY servers/k8s/mcp-server.manifest.json /servers/k8s/mcp-server.manifest.json
COPY servers/runtime-adapter/mcp-server.manifest.json /servers/runtime-adapter/mcp-server.manifest.json
COPY servers/github/mcp-server.manifest.json /servers/github/mcp-server.manifest.json
COPY servers/gitlab/mcp-server.manifest.json /servers/gitlab/mcp-server.manifest.json
COPY servers/internal-docs/mcp-server.manifest.json /servers/internal-docs/mcp-server.manifest.json
USER appuser
COPY --from=build /out/worker /usr/local/bin/worker
EXPOSE 4100
ENTRYPOINT ["/usr/local/bin/worker"]
