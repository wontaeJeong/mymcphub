package redaction

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"strings"
)

func Redact(value interface{}) interface{} {
	switch typed := value.(type) {
	case nil:
		return nil
	case string, bool, int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64, float32, float64:
		return typed
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
		encoded, err := json.Marshal(typed)
		if err == nil {
			var decoded interface{}
			if json.Unmarshal(encoded, &decoded) == nil {
				return Redact(decoded)
			}
		}
		return typed
	}
}

func Hash(value interface{}) string {
	encoded, _ := json.Marshal(Redact(value))
	sum := sha256.Sum256(encoded)
	return hex.EncodeToString(sum[:])
}

func sensitive(key string) bool {
	normalized := normalizedKey(key)
	markers := []string{"secret", "token", "password", "passwd", "credential", "apikey", "authorization", "cookie", "kubeconfig", "privatekey", "bearer", "session", "accesskey"}
	for _, marker := range markers {
		if strings.Contains(normalized, marker) {
			return true
		}
	}
	return false
}

func normalizedKey(key string) string {
	lower := strings.ToLower(key)
	var out strings.Builder
	for _, char := range lower {
		if (char >= 'a' && char <= 'z') || (char >= '0' && char <= '9') {
			out.WriteRune(char)
		}
	}
	return out.String()
}
