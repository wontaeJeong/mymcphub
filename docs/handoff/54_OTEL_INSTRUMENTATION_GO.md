# 54 OTEL Instrumentation Handoff

## Changed Files

- `internal/telemetry/telemetry.go`
- `internal/auth/auth.go`
- `internal/logger/logger.go`
- `internal/controlplane/server.go`
- `internal/gateway/server.go`
- `internal/worker/server.go`
- `internal/jobs/jobs.go`

## Contract/Schema Changes

- HTTP responses now include `x-trace-id`, `x-request-id`, and `traceparent` from the telemetry middleware.
- Gateway upstream calls forward the same correlation headers.
- Go services initialize the OpenTelemetry SDK and use `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_TRACES_SAMPLER_ARG`, and `OTEL_SDK_DISABLED` for trace exporter behavior.

## DB Migration

- None.

## Verification

- Go tests, repo lint/test/build, and manual HTTP QA passed.

## Remaining TODO

- No code TODO. A deployed OpenTelemetry Collector/backend remains environment-level configuration.

## Conflict Notes

- Auth/logging paths now import telemetry helpers; future auth changes should preserve trace/header compatibility.
