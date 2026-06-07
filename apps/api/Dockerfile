FROM golang:1.26.4-alpine AS build
WORKDIR /src
COPY go.mod go.work ./
COPY internal ./internal
COPY apps/api ./apps/api
RUN go build -o /out/api ./apps/api/cmd/api

FROM alpine:3.20
RUN adduser -D -u 10001 appuser
USER appuser
COPY --from=build /out/api /usr/local/bin/api
EXPOSE 4000
ENTRYPOINT ["/usr/local/bin/api"]
