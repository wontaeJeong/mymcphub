FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod go.work ./
COPY internal ./internal
COPY apps/cli ./apps/cli
RUN go build -o /out/mcphubctl ./apps/cli/cmd/mcphubctl

FROM alpine:3.20
RUN adduser -D -u 10001 appuser
USER appuser
COPY --from=build /out/mcphubctl /usr/local/bin/mcphubctl
ENTRYPOINT ["/usr/local/bin/mcphubctl"]
