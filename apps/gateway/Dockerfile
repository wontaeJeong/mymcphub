FROM golang:1.26.4-alpine AS build
WORKDIR /src
COPY go.mod go.work ./
COPY internal ./internal
COPY apps/gateway ./apps/gateway
RUN go build -o /out/gateway ./apps/gateway/cmd/gateway

FROM alpine:3.20
RUN adduser -D -u 10001 appuser
USER appuser
COPY --from=build /out/gateway /usr/local/bin/gateway
EXPOSE 5000
ENTRYPOINT ["/usr/local/bin/gateway"]
