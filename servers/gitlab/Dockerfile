FROM golang:1.26.4-alpine AS build
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY
ARG http_proxy
ARG https_proxy
ARG no_proxy
ENV HTTP_PROXY=${HTTP_PROXY} \
    HTTPS_PROXY=${HTTPS_PROXY} \
    NO_PROXY=${NO_PROXY} \
    http_proxy=${http_proxy} \
    https_proxy=${https_proxy} \
    no_proxy=${no_proxy}
WORKDIR /src
RUN apk add --no-cache ca-certificates
COPY deploy/certs/ /usr/local/share/ca-certificates/
RUN if find /usr/local/share/ca-certificates -type f -name '*.crt' -size +0c | grep -q .; then update-ca-certificates; fi
COPY go.mod go.work ./
COPY internal ./internal
COPY servers/gitlab ./servers/gitlab
RUN go build -o /out/gitlab-readonly ./servers/gitlab/cmd/gitlab

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
COPY deploy/certs/ /usr/local/share/ca-certificates/
RUN if find /usr/local/share/ca-certificates -type f -name '*.crt' -size +0c | grep -q .; then update-ca-certificates; fi
RUN adduser -D -u 10001 appuser
USER appuser
COPY --from=build /out/gitlab-readonly /usr/local/bin/gitlab-readonly
EXPOSE 5112
ENTRYPOINT ["/usr/local/bin/gitlab-readonly"]
