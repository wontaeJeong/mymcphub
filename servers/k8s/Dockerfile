FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod go.work ./
COPY internal ./internal
COPY servers/k8s ./servers/k8s
RUN go build -o /out/k8s-readonly ./servers/k8s/cmd/k8s

FROM alpine:3.20
RUN adduser -D -u 10001 appuser
USER appuser
COPY --from=build /out/k8s-readonly /usr/local/bin/k8s-readonly
EXPOSE 5102
ENTRYPOINT ["/usr/local/bin/k8s-readonly"]
