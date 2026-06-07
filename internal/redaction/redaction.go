package redaction

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"regexp"
	"strings"
)

const (
	ActionAllow  = "allow"
	ActionRedact = "redact"
	ActionBlock  = "block"
)

type Finding struct {
	Type   string `json:"type"`
	Action string `json:"action"`
}

type ScanResult struct {
	Action   string    `json:"action"`
	Findings []Finding `json:"findings"`
}

var contentPatterns = []struct {
	typeName string
	action   string
	pattern  *regexp.Regexp
}{
	{typeName: "private_key", action: ActionBlock, pattern: regexp.MustCompile(`-----BEGIN [A-Z ]*PRIVATE KEY-----`)},
	{typeName: "kubeconfig", action: ActionBlock, pattern: regexp.MustCompile(`(?i)apiVersion:\s*v1\s+kind:\s*Config|clusters:\s*\n\s*-\s*cluster:`)},
	{typeName: "bearer_token", action: ActionRedact, pattern: regexp.MustCompile(`(?i)bearer\s+[A-Za-z0-9._~+\-/]+=*`)},
	{typeName: "github_token", action: ActionRedact, pattern: regexp.MustCompile(`gh[pousr]_[A-Za-z0-9_]{20,}`)},
	{typeName: "aws_access_key", action: ActionRedact, pattern: regexp.MustCompile(`AKIA[0-9A-Z]{16}`)},
	{typeName: "jwt", action: ActionRedact, pattern: regexp.MustCompile(`[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}`)},
}

func Redact(value interface{}) interface{} {
	switch typed := value.(type) {
	case nil:
		return nil
	case string:
		return redactString(typed)
	case bool, int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64, float32, float64:
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
	case map[string]string:
		out := make(map[string]string, len(typed))
		for key, item := range typed {
			if sensitive(key) {
				out[key] = "[REDACTED]"
			} else {
				out[key] = redactString(item)
			}
		}
		return out
	case []interface{}:
		out := make([]interface{}, len(typed))
		for i, item := range typed {
			out[i] = Redact(item)
		}
		return out
	case []string:
		out := make([]string, len(typed))
		for i, item := range typed {
			out[i] = redactString(item)
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

func Scan(value interface{}) ScanResult {
	findings := []Finding{}
	scanValue(value, "", &findings)
	action := ActionAllow
	for _, finding := range findings {
		if finding.Action == ActionBlock {
			action = ActionBlock
			break
		}
		if finding.Action == ActionRedact {
			action = ActionRedact
		}
	}
	return ScanResult{Action: action, Findings: findings}
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

func scanValue(value interface{}, key string, findings *[]Finding) {
	switch typed := value.(type) {
	case map[string]interface{}:
		for entryKey, item := range typed {
			if sensitive(entryKey) {
				addFinding(findings, "sensitive_key", ActionRedact)
			}
			scanValue(item, entryKey, findings)
		}
	case map[string]string:
		for entryKey, item := range typed {
			if sensitive(entryKey) {
				addFinding(findings, "sensitive_key", ActionRedact)
			}
			scanString(item, findings)
		}
	case []interface{}:
		for _, item := range typed {
			scanValue(item, key, findings)
		}
	case []string:
		for _, item := range typed {
			scanString(item, findings)
		}
	case string:
		scanString(typed, findings)
	}
}

func scanString(value string, findings *[]Finding) {
	for _, matcher := range contentPatterns {
		if matcher.pattern.MatchString(value) {
			addFinding(findings, matcher.typeName, matcher.action)
		}
	}
}

func addFinding(findings *[]Finding, typeName, action string) {
	for _, finding := range *findings {
		if finding.Type == typeName && finding.Action == action {
			return
		}
	}
	*findings = append(*findings, Finding{Type: typeName, Action: action})
}

func redactString(value string) string {
	out := value
	for _, matcher := range contentPatterns {
		if matcher.action == ActionRedact {
			out = matcher.pattern.ReplaceAllString(out, "[REDACTED]")
		}
	}
	return out
}
