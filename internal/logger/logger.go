package logger

import (
	"encoding/json"
	"log"
	"os"
	"time"
)

type Logger struct {
	service string
	logger  *log.Logger
}

func New(service string) Logger                                     { return Logger{service: service, logger: log.New(os.Stderr, "", 0)} }
func (l Logger) Info(message string, fields map[string]interface{}) { l.write("info", message, fields) }
func (l Logger) Error(message string, fields map[string]interface{}) {
	l.write("error", message, fields)
}
func (l Logger) write(level, message string, fields map[string]interface{}) {
	if fields == nil {
		fields = map[string]interface{}{}
	}
	fields["ts"] = time.Now().UTC().Format(time.RFC3339Nano)
	fields["level"] = level
	fields["service"] = l.service
	fields["message"] = message
	b, _ := json.Marshal(fields)
	l.logger.Print(string(b))
}
