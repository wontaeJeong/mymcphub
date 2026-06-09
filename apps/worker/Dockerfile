FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o /out/worker ./apps/worker/cmd/worker
FROM alpine:3.21
RUN adduser -D -u 10001 app
USER 10001:10001
COPY --from=build /out/worker /worker
EXPOSE 4100
ENTRYPOINT ["/worker"]
