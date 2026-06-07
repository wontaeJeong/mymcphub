FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod go.work ./
COPY internal ./internal
COPY servers/internal-docs ./servers/internal-docs
RUN go build -o /out/internal-docs-readonly ./servers/internal-docs/cmd/internal-docs

FROM alpine:3.20
RUN adduser -D -u 10001 appuser
USER appuser
COPY --from=build /out/internal-docs-readonly /usr/local/bin/internal-docs-readonly
EXPOSE 5113
ENTRYPOINT ["/usr/local/bin/internal-docs-readonly"]
