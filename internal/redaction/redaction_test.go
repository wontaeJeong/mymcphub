package redaction

import (
	"bytes"
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
		"nested":         map[string]interface{}{"Authorization": "secret", "refresh.token": "secret", "safe": "kept"},
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
	if nested["Authorization"] != "[REDACTED]" || nested["refresh.token"] != "[REDACTED]" || nested["safe"] != "kept" {
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

func TestRedactCoversSensitiveKeysAndStringPatterns(t *testing.T) {
	input := map[string]interface{}{
		"authorization": "Bearer secret-token-value",
		"message":       "call with Bearer abcdefghijklmnopqrstuvwxyz.abcdefghijklmnopqrstuv.abcdefghijklmnopqrstuv",
		"nested": map[string]interface{}{
			"apiKey": "plaintext",
		},
	}

	encoded, _ := json.Marshal(Redact(input))
	if bytes.Contains(encoded, []byte("secret-token-value")) || bytes.Contains(encoded, []byte("plaintext")) {
		t.Fatalf("redacted payload leaked secret material: %s", string(encoded))
	}
	if !bytes.Contains(encoded, []byte("[REDACTED]")) {
		t.Fatalf("expected redaction marker in %s", string(encoded))
	}
}

func TestScanBlocksPrivateKeyAndKubeconfigContent(t *testing.T) {
	result := Scan(map[string]interface{}{"payload": "-----BEGIN RSA PRIVATE KEY-----\nsecret\n-----END RSA PRIVATE KEY-----"})
	if result.Action != ActionBlock {
		t.Fatalf("expected block action for private key, got %#v", result)
	}

	result = Scan(map[string]interface{}{"payload": "apiVersion: v1\nkind: Config\nclusters:\n- cluster:\n"})
	if result.Action != ActionBlock {
		t.Fatalf("expected block action for kubeconfig, got %#v", result)
	}
}
