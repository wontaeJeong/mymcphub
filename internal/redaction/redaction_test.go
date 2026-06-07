package redaction

import (
	"encoding/json"
	"testing"
)

func TestRedactCoversDocumentedSensitiveKeyVariants(t *testing.T) {
	input := map[string]interface{}{
		"password":       "secret",
		"passwd":         "secret",
		"token":          "secret",
		"secret":         "secret",
		"apiKey":         "secret",
		"apikey":         "secret",
		"api_key":        "secret",
		"api-key":        "secret",
		"authorization":  "secret",
		"cookie":         "secret",
		"kubeconfig":     "secret",
		"privateKey":     "secret",
		"private_key":    "secret",
		"credential":     "secret",
		"bearer":         "secret",
		"session":        "secret",
		"accessKeyId":    "secret",
		"safe":           "kept",
		"nested":         map[string]interface{}{"Authorization": "secret", "safe": "kept"},
		"headerVariants": []interface{}{map[string]interface{}{"x-api-key": "secret", "safe": "kept"}},
	}

	redacted := Redact(input).(map[string]interface{})
	for key, value := range redacted {
		if key == "safe" || key == "nested" || key == "headerVariants" {
			continue
		}
		if value != "[REDACTED]" {
			t.Fatalf("expected %s to be redacted, got %#v", key, value)
		}
	}
	if redacted["safe"] != "kept" {
		t.Fatalf("expected safe field to be preserved, got %#v", redacted["safe"])
	}
	nested := redacted["nested"].(map[string]interface{})
	if nested["Authorization"] != "[REDACTED]" || nested["safe"] != "kept" {
		t.Fatalf("expected nested authorization redaction, got %#v", nested)
	}
	headerVariants := redacted["headerVariants"].([]interface{})
	header := headerVariants[0].(map[string]interface{})
	if header["x-api-key"] != "[REDACTED]" || header["safe"] != "kept" {
		t.Fatalf("expected header variant redaction, got %#v", header)
	}
}

func TestRedactCredentialKeyVariants(t *testing.T) {
	redacted := Redact(map[string]interface{}{
		"apiKey":        "raw-api-key",
		"api_key":       "raw-api-key",
		"authorization": "Bearer raw-token",
		"privateKey":    "raw-private-key",
		"cookie":        "raw-cookie",
		"nested":        map[string]interface{}{"access-key": "raw-access-key"},
	})
	encoded, _ := json.Marshal(redacted)
	if string(encoded) != `{"apiKey":"[REDACTED]","api_key":"[REDACTED]","authorization":"[REDACTED]","cookie":"[REDACTED]","nested":{"access-key":"[REDACTED]"},"privateKey":"[REDACTED]"}` {
		t.Fatalf("unexpected redaction: %s", encoded)
	}
}
