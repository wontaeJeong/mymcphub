package mcp

import (
	"encoding/json"
	"net/http"
	"strings"
)

type ToolDefinition struct {
	Name        string
	Description string
	InputSchema map[string]interface{}
	PolicyTags  []string
	ReadOnly    bool
	Call        func(map[string]interface{}) (map[string]interface{}, error)
}

type ResourceDefinition struct {
	URI         string
	Name        string
	Description string
	MimeType    string
	Text        string
}

type PromptDefinition struct {
	Name        string
	Description string
	Messages    []map[string]interface{}
}

type SimpleServer struct {
	Name      string
	Version   string
	Tools     []ToolDefinition
	Resources []ResourceDefinition
	Prompts   []PromptDefinition
}

func (s SimpleServer) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, map[string]interface{}{"status": "ok", "server": s.Name, "version": firstNonEmpty(s.Version, "0.1.0")})
	})
	mux.HandleFunc("/mcp", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSON(w, 404, map[string]string{"error": "not_found"})
			return
		}
		var body interface{}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, 400, Error(nil, -32700, "Parse error"))
			return
		}
		request, err := ParseRequest(body)
		if err != nil {
			writeJSON(w, 400, Error(nil, -32600, "Invalid Request"))
			return
		}
		s.handleMCP(w, request)
	})
	return mux
}

func (s SimpleServer) handleMCP(w http.ResponseWriter, request Request) {
	switch request.Method {
	case "initialize":
		writeJSON(w, 200, Result(request.ID, map[string]interface{}{"protocolVersion": "2025-03-26", "capabilities": map[string]interface{}{"tools": map[string]interface{}{}, "resources": map[string]interface{}{}, "prompts": map[string]interface{}{}}, "serverInfo": map[string]interface{}{"name": s.Name, "version": firstNonEmpty(s.Version, "0.1.0")}}))
	case "ping":
		writeJSON(w, 200, Result(request.ID, map[string]interface{}{}))
	case "tools/list":
		writeJSON(w, 200, Result(request.ID, map[string]interface{}{"tools": s.toolDescriptors()}))
	case "tools/call":
		s.callTool(w, request)
	case "resources/list":
		writeJSON(w, 200, Result(request.ID, map[string]interface{}{"resources": s.resourceDescriptors()}))
	case "resources/read":
		s.readResource(w, request)
	case "prompts/list":
		writeJSON(w, 200, Result(request.ID, map[string]interface{}{"prompts": s.promptDescriptors()}))
	case "prompts/get":
		s.getPrompt(w, request)
	default:
		writeJSON(w, 200, Error(request.ID, -32601, "Method not found: "+request.Method))
	}
}

func (s SimpleServer) callTool(w http.ResponseWriter, request Request) {
	name, _ := request.Params["name"].(string)
	args, _ := request.Params["arguments"].(map[string]interface{})
	if args == nil {
		args = map[string]interface{}{}
	}
	for _, tool := range s.Tools {
		if tool.Name != name {
			continue
		}
		result, err := tool.Call(args)
		if err != nil {
			writeJSON(w, 200, Error(request.ID, -32602, err.Error()))
			return
		}
		writeJSON(w, 200, Result(request.ID, result))
		return
	}
	writeJSON(w, 200, Error(request.ID, -32601, "Unknown tool: "+name))
}

func (s SimpleServer) readResource(w http.ResponseWriter, request Request) {
	uri, _ := request.Params["uri"].(string)
	for _, resource := range s.Resources {
		if resource.URI == uri {
			mimeType := firstNonEmpty(resource.MimeType, "text/plain")
			writeJSON(w, 200, Result(request.ID, map[string]interface{}{"contents": []interface{}{map[string]interface{}{"uri": resource.URI, "mimeType": mimeType, "text": resource.Text}}}))
			return
		}
	}
	writeJSON(w, 200, Error(request.ID, -32602, "Unknown resource"))
}

func (s SimpleServer) getPrompt(w http.ResponseWriter, request Request) {
	name, _ := request.Params["name"].(string)
	for _, prompt := range s.Prompts {
		if prompt.Name == name {
			writeJSON(w, 200, Result(request.ID, map[string]interface{}{"description": prompt.Description, "messages": prompt.Messages}))
			return
		}
	}
	writeJSON(w, 200, Error(request.ID, -32602, "Unknown prompt"))
}

func (s SimpleServer) toolDescriptors() []map[string]interface{} {
	out := []map[string]interface{}{}
	for _, tool := range s.Tools {
		annotations := map[string]interface{}{"readOnlyHint": tool.ReadOnly, "destructiveHint": !tool.ReadOnly}
		if len(tool.PolicyTags) > 0 {
			annotations["policyTags"] = tool.PolicyTags
		}
		out = append(out, map[string]interface{}{"name": tool.Name, "description": tool.Description, "inputSchema": tool.InputSchema, "annotations": annotations, "policyTags": tool.PolicyTags})
	}
	return out
}

func (s SimpleServer) resourceDescriptors() []map[string]interface{} {
	out := []map[string]interface{}{}
	for _, resource := range s.Resources {
		descriptor := map[string]interface{}{"uri": resource.URI, "name": resource.Name}
		if resource.Description != "" {
			descriptor["description"] = resource.Description
		}
		if resource.MimeType != "" {
			descriptor["mimeType"] = resource.MimeType
		}
		out = append(out, descriptor)
	}
	return out
}

func (s SimpleServer) promptDescriptors() []map[string]interface{} {
	out := []map[string]interface{}{}
	for _, prompt := range s.Prompts {
		out = append(out, map[string]interface{}{"name": prompt.Name, "description": prompt.Description})
	}
	return out
}

func ObjectSchema(properties map[string]interface{}, required []interface{}) map[string]interface{} {
	if properties == nil {
		properties = map[string]interface{}{}
	}
	out := map[string]interface{}{"type": "object", "properties": properties, "additionalProperties": false}
	if len(required) > 0 {
		out["required"] = required
	}
	return out
}

func TextJSON(value map[string]interface{}) map[string]interface{} {
	encoded, _ := json.Marshal(value)
	return TextContent(string(encoded))
}

func TextContent(text string) map[string]interface{} {
	return map[string]interface{}{"content": []interface{}{map[string]interface{}{"type": "text", "text": text}}}
}

func InputError(message string) error { return inputError{message: message} }

type inputError struct{ message string }

func (e inputError) Error() string { return e.message }

func writeJSON(w http.ResponseWriter, status int, value interface{}) {
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
