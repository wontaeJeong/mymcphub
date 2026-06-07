package main

import (
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/mcp-hub/mcp-hub/internal/mcp"
)

type document struct {
	URI   string
	Title string
	Text  string
}

var documents = []document{
	{URI: "internal-docs://runtime-controller", Title: "Runtime Controller Runbook", Text: "Runtime reconciliation renders Deployment, Service, RBAC, NetworkPolicy, sandbox, and secret reference manifests before GitOps apply."},
	{URI: "internal-docs://secret-leases", Title: "Secret Lease Handling", Text: "Secret leases carry references only. Raw credentials must remain in the platform secret store and are never returned by tools."},
	{URI: "internal-docs://egress-policy", Title: "Egress Policy", Text: "Managed MCP servers deny egress by default, allow DNS, and annotate host allowlists for CNI-specific policy enforcement."},
}

func main() {
	port := 5113
	if value := os.Getenv("PORT"); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil {
			port = parsed
		}
	}
	log.Fatal(http.ListenAndServe(":"+strconv.Itoa(port), server().Handler()))
}

func server() mcp.SimpleServer {
	resources := []mcp.ResourceDefinition{}
	for _, doc := range documents {
		resources = append(resources, mcp.ResourceDefinition{URI: doc.URI, Name: doc.Title, Description: "Read-only internal documentation resource", MimeType: "text/plain", Text: redact(doc.Text)})
	}
	return mcp.SimpleServer{Name: "internal-docs-readonly", Version: "0.1.0", Resources: resources, Prompts: []mcp.PromptDefinition{{Name: "summarize-runbook", Description: "Summarize a retrieved runbook for an operator.", Messages: []map[string]interface{}{{"role": "user", "content": map[string]interface{}{"type": "text", "text": "Summarize the selected internal runbook with risks and validation steps. Do not include secrets."}}}}}, Tools: []mcp.ToolDefinition{
		{Name: "search_docs", Description: "Search read-only internal documentation with DLP redaction applied to snippets.", InputSchema: mcp.ObjectSchema(map[string]interface{}{"query": map[string]interface{}{"type": "string"}}, []interface{}{"query"}), ReadOnly: true, PolicyTags: []string{"internal-docs", "readonly", "dlp"}, Call: func(args map[string]interface{}) (map[string]interface{}, error) {
			query, _ := args["query"].(string)
			results := []map[string]string{}
			for _, doc := range documents {
				if strings.Contains(strings.ToLower(doc.Title+" "+doc.Text), strings.ToLower(query)) {
					results = append(results, map[string]string{"uri": doc.URI, "title": doc.Title, "snippet": redact(doc.Text)})
				}
			}
			return mcp.TextJSON(map[string]interface{}{"query": query, "results": results}), nil
		}},
	}}
}

func redact(text string) string {
	for _, marker := range []string{"token", "secret", "password", "credential"} {
		text = strings.ReplaceAll(text, marker, "[redacted]")
		text = strings.ReplaceAll(text, strings.ToUpper(marker), "[REDACTED]")
	}
	return text
}
