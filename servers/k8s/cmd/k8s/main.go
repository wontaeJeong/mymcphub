package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strconv"

	"github.com/mcp-hub/mcp-hub/internal/mcp"
)

type pod struct {
	Namespace string            `json:"namespace"`
	Name      string            `json:"name"`
	Phase     string            `json:"phase"`
	NodeName  string            `json:"nodeName"`
	Labels    map[string]string `json:"labels"`
}
type tool struct {
	Name        string
	Description string
	InputSchema map[string]interface{}
	Call        func(map[string]interface{}) (map[string]interface{}, error)
}

var namespaces = []string{"default", "platform", "observability"}
var pods = []pod{{Namespace: "default", Name: "web-7d9c5f", Phase: "Running", NodeName: "kind-worker", Labels: map[string]string{"app": "web"}}, {Namespace: "platform", Name: "mcp-gateway-6f8b9", Phase: "Running", NodeName: "kind-control-plane", Labels: map[string]string{"app": "mcp-gateway"}}, {Namespace: "observability", Name: "otel-collector-0", Phase: "Pending", NodeName: "kind-worker", Labels: map[string]string{"app": "otel"}}}

var tools = []tool{
	{Name: "list_namespaces", Description: "List namespace names from the local read-only mock Kubernetes dataset.", InputSchema: objectSchema(nil, nil), Call: func(_ map[string]interface{}) (map[string]interface{}, error) {
		return textJSON(map[string]interface{}{"namespaces": namespaces}), nil
	}},
	{Name: "list_pods", Description: "List pods in one namespace from the local read-only mock Kubernetes dataset.", InputSchema: objectSchema(map[string]interface{}{"namespace": map[string]interface{}{"type": "string", "description": "Namespace to inspect."}}, []interface{}{"namespace"}), Call: func(args map[string]interface{}) (map[string]interface{}, error) {
		namespace, ok := args["namespace"].(string)
		if !ok || !knownNamespace(namespace) {
			return nil, rpcInput("Unknown namespace")
		}
		out := []pod{}
		for _, item := range pods {
			if item.Namespace == namespace {
				out = append(out, item)
			}
		}
		return textJSON(map[string]interface{}{"pods": out}), nil
	}},
	{Name: "get_pod", Description: "Read one pod by namespace and name from the local read-only mock Kubernetes dataset.", InputSchema: objectSchema(map[string]interface{}{"namespace": map[string]interface{}{"type": "string"}, "podName": map[string]interface{}{"type": "string"}}, []interface{}{"namespace", "podName"}), Call: func(args map[string]interface{}) (map[string]interface{}, error) {
		namespace, _ := args["namespace"].(string)
		podName, _ := args["podName"].(string)
		for _, item := range pods {
			if item.Namespace == namespace && item.Name == podName {
				return textJSON(map[string]interface{}{"pod": item}), nil
			}
		}
		return nil, rpcInput("Unknown pod")
	}},
}

func main() {
	port := 5102
	if value := os.Getenv("PORT"); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil {
			port = parsed
		}
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, map[string]interface{}{"status": "ok", "server": "k8s-readonly", "mode": "mock"})
	})
	mux.HandleFunc("/mcp", handleMCP)
	log.Fatal(http.ListenAndServe(":"+strconv.Itoa(port), mux))
}

func handleMCP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, 404, map[string]string{"error": "not_found"})
		return
	}
	var body interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, 400, mcp.Error(nil, -32700, "Parse error"))
		return
	}
	request, err := mcp.ParseRequest(body)
	if err != nil {
		writeJSON(w, 400, mcp.Error(nil, -32600, "Invalid Request"))
		return
	}
	switch request.Method {
	case "initialize":
		writeJSON(w, 200, mcp.Result(request.ID, map[string]interface{}{"protocolVersion": "2025-03-26", "capabilities": map[string]interface{}{"tools": map[string]interface{}{}, "resources": map[string]interface{}{}, "prompts": map[string]interface{}{}}, "serverInfo": map[string]interface{}{"name": "k8s-readonly", "version": "0.1.0"}}))
	case "ping":
		writeJSON(w, 200, mcp.Result(request.ID, map[string]interface{}{}))
	case "tools/list":
		writeJSON(w, 200, mcp.Result(request.ID, map[string]interface{}{"tools": descriptors()}))
	case "tools/call":
		callTool(w, request)
	case "resources/list":
		resources := []map[string]string{}
		for _, namespace := range namespaces {
			resources = append(resources, map[string]string{"uri": "k8s-readonly://namespaces/" + namespace, "name": namespace})
		}
		writeJSON(w, 200, mcp.Result(request.ID, map[string]interface{}{"resources": resources}))
	case "prompts/list":
		writeJSON(w, 200, mcp.Result(request.ID, map[string]interface{}{"prompts": []interface{}{}}))
	default:
		writeJSON(w, 200, mcp.Error(request.ID, -32601, "Method not found: "+request.Method))
	}
}

func callTool(w http.ResponseWriter, request mcp.Request) {
	name, _ := request.Params["name"].(string)
	args, _ := request.Params["arguments"].(map[string]interface{})
	for _, item := range tools {
		if item.Name == name {
			result, err := item.Call(args)
			if err != nil {
				writeJSON(w, 200, mcp.Error(request.ID, -32602, err.Error()))
				return
			}
			writeJSON(w, 200, mcp.Result(request.ID, result))
			return
		}
	}
	writeJSON(w, 200, mcp.Error(request.ID, -32601, "Unknown tool: "+name))
}
func descriptors() []map[string]interface{} {
	out := []map[string]interface{}{}
	for _, item := range tools {
		out = append(out, map[string]interface{}{"name": item.Name, "description": item.Description, "inputSchema": item.InputSchema})
	}
	return out
}
func writeJSON(w http.ResponseWriter, status int, value interface{}) {
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func objectSchema(properties map[string]interface{}, required []interface{}) map[string]interface{} {
	if properties == nil {
		properties = map[string]interface{}{}
	}
	out := map[string]interface{}{"type": "object", "properties": properties, "additionalProperties": false}
	if required != nil {
		out["required"] = required
	}
	return out
}
func textJSON(value map[string]interface{}) map[string]interface{} {
	encoded, _ := json.Marshal(value)
	return map[string]interface{}{"content": []interface{}{map[string]interface{}{"type": "text", "text": string(encoded)}}}
}
func knownNamespace(namespace string) bool {
	for _, item := range namespaces {
		if item == namespace {
			return true
		}
	}
	return false
}
func rpcInput(message string) error { return &inputError{message: message} }

type inputError struct{ message string }

func (e *inputError) Error() string { return e.message }
