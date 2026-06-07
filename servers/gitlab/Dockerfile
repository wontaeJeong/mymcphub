FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod go.work ./
COPY internal ./internal
COPY servers/gitlab ./servers/gitlab
RUN go build -o /out/gitlab-readonly ./servers/gitlab/cmd/gitlab

FROM alpine:3.20
RUN adduser -D -u 10001 appuser
USER appuser
COPY --from=build /out/gitlab-readonly /usr/local/bin/gitlab-readonly
EXPOSE 5112
ENTRYPOINT ["/usr/local/bin/gitlab-readonly"]
