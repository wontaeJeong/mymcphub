package logger

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"strings"
	"time"

	"github.com/mcp-hub/mcp-hub/internal/telemetry"
)

type Logger struct {
	service string
	logger  *log.Logger
}

func New(service string) Logger { return Logger{service: service, logger: log.New(os.Stderr, "", 0)} }

func (l Logger) Info(message string, fields map[string]interface{}) { l.write("info", message, fields) }
func (l Logger) Error(message string, fields map[string]interface{}) {
	l.write("error", message, fields)
}
func (l Logger) InfoContext(ctx context.Context, message string, fields map[string]interface{}) {
	l.writeContext(ctx, "info", message, fields)
}
func (l Logger) ErrorContext(ctx context.Context, message string, fields map[string]interface{}) {
	l.writeContext(ctx, "error", message, fields)
}

func (l Logger) writeContext(ctx context.Context, level, message string, fields map[string]interface{}) {
	if fields == nil {
		fields = map[string]interface{}{}
	}
	if traceID := telemetry.TraceID(ctx); traceID != "" {
		fields["traceId"] = traceID
	}
	if spanID := telemetry.SpanID(ctx); spanID != "" {
		fields["spanId"] = spanID
	}
	if requestID := telemetry.RequestID(ctx); requestID != "" {
		fields["requestId"] = requestID
	}
	l.write(level, message, fields)
}

func (l Logger) write(level, message string, fields map[string]interface{}) {
	if fields == nil {
		fields = map[string]interface{}{}
	}
	fields["ts"] = time.Now().UTC().Format(time.RFC3339Nano)
	fields["level"] = level
	fields["service"] = l.service
	fields["message"] = message
	if shouldDrop(fields) {
		return
	}
	encoded, err := json.Marshal(fields)
	if err != nil {
		l.logger.Printf(`{"level":"error","message":"log encoding failed"}`)
		return
	}
	l.logger.Print(string(encoded))
}

func shouldDrop(fields map[string]interface{}) bool {
	for key := range fields {
		lower := strings.ToLower(key)
		if lower == "password" || lower == "secret" || lower == "token" || strings.Contains(lower, "clientsecret") {
			fields[key] = "[REDACTED]"
		}
	}
	return false
}
