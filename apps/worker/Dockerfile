FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod go.work ./
COPY internal ./internal
COPY apps/worker ./apps/worker
RUN go build -o /out/worker ./apps/worker/cmd/worker

FROM alpine:3.20
RUN adduser -D -u 10001 appuser
USER appuser
COPY --from=build /out/worker /usr/local/bin/worker
EXPOSE 4100
ENTRYPOINT ["/usr/local/bin/worker"]
