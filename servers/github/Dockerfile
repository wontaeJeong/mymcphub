FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod go.work ./
COPY internal ./internal
COPY servers/github ./servers/github
RUN go build -o /out/github-readonly ./servers/github/cmd/github

FROM alpine:3.20
RUN adduser -D -u 10001 appuser
USER appuser
COPY --from=build /out/github-readonly /usr/local/bin/github-readonly
EXPOSE 5111
ENTRYPOINT ["/usr/local/bin/github-readonly"]
