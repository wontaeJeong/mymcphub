package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

var riskLevels = map[string]bool{"low": true, "medium": true, "high": true, "critical": true}
var dangerousKeywords = []string{"delete", "exec", "shell", "apply", "write", "push", "merge", "deploy", "secret", "credential", "token", "admin", "cluster"}

type finding struct {
	file    string
	level   string
	message string
}

func main() {
	rootDir, err := os.Getwd()
	if err != nil {
		fmt.Printf("SKIP: unable to read working directory: %v\n", err)
		return
	}

	files := explicitFiles(os.Args[1:])
	if len(files) == 0 {
		files = defaultManifestFiles(rootDir)
	}
	if len(files) == 0 {
		fmt.Println("SKIP: no MCP manifests found under servers/*/mcp-server.manifest.json")
		return
	}

	findings := []finding{}
	for _, file := range files {
		checkManifest(rootDir, file, &findings)
	}

	errorCount := 0
	warningCount := 0
	for _, item := range findings {
		prefix := "REVIEW"
		if item.level == "error" {
			prefix = "ERROR"
			errorCount++
		} else {
			warningCount++
		}
		fmt.Printf("%s: %s: %s\n", prefix, item.file, item.message)
	}

	if errorCount > 0 {
		fmt.Printf("MCP manifest check failed with %d error(s) and %d review warning(s).\n", errorCount, warningCount)
		os.Exit(1)
	}
	fmt.Printf("MCP manifest check passed for %d file(s) with %d review warning(s).\n", len(files), warningCount)
}

func explicitFiles(args []string) []string {
	files := []string{}
	for _, arg := range args {
		if arg != "--" {
			files = append(files, arg)
		}
	}
	return files
}

func defaultManifestFiles(rootDir string) []string {
	serversDir := filepath.Join(rootDir, "servers")
	entries, err := os.ReadDir(serversDir)
	if err != nil {
		fmt.Printf("SKIP: unable to read servers directory: %v\n", err)
		return nil
	}
	files := []string{}
	for _, entry := range entries {
		if entry.IsDir() {
			manifestPath := filepath.Join(serversDir, entry.Name(), "mcp-server.manifest.json")
			if _, err := os.Stat(manifestPath); err == nil {
				files = append(files, manifestPath)
			}
		}
	}
	return files
}

func checkManifest(rootDir, file string, findings *[]finding) {
	label, err := filepath.Rel(rootDir, file)
	if err != nil {
		label = file
	}
	manifest, ok := readJSON(file, label, findings)
	if !ok {
		return
	}

	requireNonEmptyString(manifest["slug"], label, "missing slug", findings)
	requireNonEmptyString(manifest["ownerTeam"], label, "missing ownerTeam", findings)
	requireNonEmptyString(manifest["ownerTeamId"], label, "missing ownerTeamId", findings)
	requireRiskLevel(manifest["riskLevel"], label, "missing manifest riskLevel", "invalid manifest riskLevel", findings)

	tools, ok := manifest["tools"].([]interface{})
	if !ok {
		addError(findings, label, "tools must be an array")
		return
	}
	for index, rawTool := range tools {
		tool, ok := rawTool.(map[string]interface{})
		toolLabel := fmt.Sprintf("%s tools[%d]", label, index)
		if !ok {
			addError(findings, toolLabel, "tool must be an object")
			continue
		}
		toolName, _ := tool["name"].(string)
		if toolName == "" {
			toolName = fmt.Sprintf("tools[%d]", index)
		}
		namedToolLabel := fmt.Sprintf("%s %s", label, toolName)
		toolRiskLevel := requireRiskLevel(tool["riskLevel"], namedToolLabel, "missing tool riskLevel", "invalid tool riskLevel", findings)

		inputSchema, ok := tool["inputSchema"].(map[string]interface{})
		if !ok {
			addError(findings, namedToolLabel, "invalid tool inputSchema object")
		} else if inputSchema["type"] != "object" {
			addError(findings, namedToolLabel, "inputSchema.type must be object")
		} else if inputSchema["additionalProperties"] != false {
			addError(findings, namedToolLabel, "missing additionalProperties false on inputSchema")
		}

		if (toolRiskLevel == "high" || toolRiskLevel == "critical") && !hasDescription(tool["description"]) {
			addError(findings, namedToolLabel, "high/critical tools require descriptions")
		}
		if (toolRiskLevel == "high" || toolRiskLevel == "critical") && tool["readOnly"] != true {
			addWarning(findings, namedToolLabel, "high/critical tool is not explicitly readOnly true and needs security review")
		}
		hits := []string{}
		for _, keyword := range dangerousKeywords {
			if containsKeyword(tool, keyword) {
				hits = append(hits, keyword)
			}
		}
		if len(hits) > 0 {
			addWarning(findings, namedToolLabel, "dangerous keyword review needed: "+strings.Join(hits, ", "))
		}
	}
}

func readJSON(file, label string, findings *[]finding) (map[string]interface{}, bool) {
	data, err := os.ReadFile(file)
	if err != nil {
		addError(findings, label, "unable to read or parse manifest: "+err.Error())
		return nil, false
	}
	manifest := map[string]interface{}{}
	if err := json.Unmarshal(data, &manifest); err != nil {
		addError(findings, label, "unable to read or parse manifest: "+err.Error())
		return nil, false
	}
	return manifest, true
}

func requireNonEmptyString(value interface{}, file string, message string, findings *[]finding) {
	text, ok := value.(string)
	if !ok || strings.TrimSpace(text) == "" {
		addError(findings, file, message)
	}
}

func requireRiskLevel(value interface{}, file, missingMessage, invalidMessage string, findings *[]finding) string {
	text, ok := value.(string)
	if !ok || strings.TrimSpace(text) == "" {
		addError(findings, file, missingMessage)
		return ""
	}
	if !riskLevels[text] {
		addError(findings, file, fmt.Sprintf("%s: %s", invalidMessage, text))
		return ""
	}
	return text
}

func hasDescription(value interface{}) bool {
	text, ok := value.(string)
	return ok && strings.TrimSpace(text) != ""
}

func containsKeyword(value interface{}, keyword string) bool {
	switch typed := value.(type) {
	case string:
		return strings.Contains(strings.ToLower(typed), keyword)
	case []interface{}:
		for _, item := range typed {
			if containsKeyword(item, keyword) {
				return true
			}
		}
	case map[string]interface{}:
		for entryKey, entryValue := range typed {
			if strings.Contains(strings.ToLower(entryKey), keyword) || containsKeyword(entryValue, keyword) {
				return true
			}
		}
	}
	return false
}

func addError(findings *[]finding, file, message string) {
	*findings = append(*findings, finding{file: file, level: "error", message: message})
}

func addWarning(findings *[]finding, file, message string) {
	*findings = append(*findings, finding{file: file, level: "warning", message: message})
}
