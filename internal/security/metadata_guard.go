package security

import (
	"strings"

	"github.com/mcp-hub/mcp-hub/internal/db"
)

type MetadataFinding struct {
	Phrase  string `json:"phrase"`
	Message string `json:"message"`
}

type MetadataScan struct {
	Subject               string            `json:"subject"`
	QuarantineRecommended bool              `json:"quarantineRecommended"`
	RiskyPhrases          []string          `json:"riskyPhrases"`
	Findings              []MetadataFinding `json:"findings"`
}

var riskyPhrases = []string{
	"ignore previous instructions",
	"ignore all instructions",
	"system prompt",
	"developer message",
	"reveal secrets",
	"exfiltrate",
	"send credentials",
	"bypass policy",
	"disable safety",
	"jailbreak",
}

func ScanToolMetadata(tool db.MCPTool) MetadataScan {
	subject := tool.Name
	text := strings.Join([]string{tool.Name, tool.Description}, " ")
	return scanText(subject, text)
}

func ScanText(subject, text string) MetadataScan {
	return scanText(subject, text)
}

func scanText(subject, text string) MetadataScan {
	lower := strings.ToLower(text)
	out := MetadataScan{Subject: subject}
	seen := map[string]bool{}
	for _, phrase := range riskyPhrases {
		if strings.Contains(lower, phrase) && !seen[phrase] {
			seen[phrase] = true
			out.RiskyPhrases = append(out.RiskyPhrases, phrase)
			out.Findings = append(out.Findings, MetadataFinding{Phrase: phrase, Message: "Tool metadata contains prompt-injection language."})
		}
	}
	out.QuarantineRecommended = len(out.Findings) > 0
	return out
}
