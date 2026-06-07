package redaction

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"strings"
)

func Redact(value interface{}) interface{} {
	switch typed := value.(type) {
	case map[string]interface{}:
		out := make(map[string]interface{}, len(typed))
		for key, item := range typed {
			if sensitive(key) {
				out[key] = "[REDACTED]"
			} else {
				out[key] = Redact(item)
			}
		}
		return out
	case []interface{}:
		out := make([]interface{}, len(typed))
		for i, item := range typed {
			out[i] = Redact(item)
		}
		return out
	default:
		return typed
	}
}

func Hash(value interface{}) string {
	encoded, _ := json.Marshal(Redact(value))
	sum := sha256.Sum256(encoded)
	return hex.EncodeToString(sum[:])
}

func sensitive(key string) bool {
	lower := strings.ToLower(key)
	return strings.Contains(lower, "secret") || strings.Contains(lower, "token") || strings.Contains(lower, "password") || strings.Contains(lower, "credential")
}
