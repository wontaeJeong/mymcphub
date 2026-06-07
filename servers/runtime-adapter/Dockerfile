FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod go.work ./
COPY internal ./internal
COPY servers/runtime-adapter ./servers/runtime-adapter
RUN go build -o /out/runtime-adapter ./servers/runtime-adapter/cmd/runtime-adapter

FROM alpine:3.20
RUN adduser -D -u 10001 appuser
USER appuser
COPY --from=build /out/runtime-adapter /usr/local/bin/runtime-adapter
EXPOSE 5110
ENTRYPOINT ["/usr/local/bin/runtime-adapter"]
