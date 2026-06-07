package main

import (
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/mcp-hub/mcp-hub/internal/mcp"
)

type pod struct {
	Namespace string            `json:"namespace"`
	Name      string            `json:"name"`
	Phase     string            `json:"phase"`
	NodeName  string            `json:"nodeName"`
	Labels    map[string]string `json:"labels"`
}

var allNamespaces = []string{"default", "platform", "observability"}
var pods = []pod{{Namespace: "default", Name: "web-7d9c5f", Phase: "Running", NodeName: "kind-worker", Labels: map[string]string{"app": "web"}}, {Namespace: "platform", Name: "mcp-gateway-6f8b9", Phase: "Running", NodeName: "kind-control-plane", Labels: map[string]string{"app": "mcp-gateway"}}, {Namespace: "observability", Name: "otel-collector-0", Phase: "Pending", NodeName: "kind-worker", Labels: map[string]string{"app": "otel"}}}

func main() {
	port := 5102
	if value := os.Getenv("PORT"); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil {
			port = parsed
		}
	}
	log.Fatal(http.ListenAndServe(":"+strconv.Itoa(port), newServer().Handler()))
}

func newServer() mcp.SimpleServer {
	namespaces := allowedNamespaces()
	return mcp.SimpleServer{
		Name:    "k8s-readonly",
		Version: "0.2.0",
		Tools: []mcp.ToolDefinition{
			{Name: "list_namespaces", Description: "List namespace names from the configured read-only Kubernetes namespace scope.", InputSchema: mcp.ObjectSchema(nil, nil), ReadOnly: true, PolicyTags: []string{"kubernetes", "readonly", "namespace-scope"}, Call: func(_ map[string]interface{}) (map[string]interface{}, error) {
				return mcp.TextJSON(map[string]interface{}{"namespaces": namespaces}), nil
			}},
			{Name: "list_pods", Description: "List pods in one allowed namespace from the read-only Kubernetes namespace scope.", InputSchema: mcp.ObjectSchema(map[string]interface{}{"namespace": map[string]interface{}{"type": "string", "description": "Namespace to inspect."}}, []interface{}{"namespace"}), ReadOnly: true, PolicyTags: []string{"kubernetes", "readonly", "pods"}, Call: func(args map[string]interface{}) (map[string]interface{}, error) {
				namespace, ok := args["namespace"].(string)
				if !ok || !knownNamespace(namespaces, namespace) {
					return nil, mcp.InputError("Namespace is outside the configured read-only scope")
				}
				out := []pod{}
				for _, item := range pods {
					if item.Namespace == namespace {
						out = append(out, item)
					}
				}
				return mcp.TextJSON(map[string]interface{}{"pods": out}), nil
			}},
			{Name: "get_pod", Description: "Read one pod by namespace and name from the configured read-only Kubernetes namespace scope.", InputSchema: mcp.ObjectSchema(map[string]interface{}{"namespace": map[string]interface{}{"type": "string", "description": "Pod namespace."}, "podName": map[string]interface{}{"type": "string", "description": "Pod name."}}, []interface{}{"namespace", "podName"}), ReadOnly: true, PolicyTags: []string{"kubernetes", "readonly", "pods"}, Call: func(args map[string]interface{}) (map[string]interface{}, error) {
				namespace, _ := args["namespace"].(string)
				podName, _ := args["podName"].(string)
				if !knownNamespace(namespaces, namespace) {
					return nil, mcp.InputError("Namespace is outside the configured read-only scope")
				}
				for _, item := range pods {
					if item.Namespace == namespace && item.Name == podName {
						return mcp.TextJSON(map[string]interface{}{"pod": item}), nil
					}
				}
				return nil, mcp.InputError("Unknown pod")
			}},
		},
		Resources: namespaceResources(namespaces),
	}
}

func allowedNamespaces() []string {
	value := strings.TrimSpace(os.Getenv("K8S_ALLOWED_NAMESPACES"))
	if value == "" {
		return allNamespaces
	}
	out := []string{}
	for _, item := range strings.Split(value, ",") {
		item = strings.TrimSpace(item)
		if item != "" && knownNamespace(allNamespaces, item) {
			out = append(out, item)
		}
	}
	if len(out) == 0 {
		return allNamespaces
	}
	return out
}

func namespaceResources(namespaces []string) []mcp.ResourceDefinition {
	resources := []mcp.ResourceDefinition{}
	for _, namespace := range namespaces {
		resources = append(resources, mcp.ResourceDefinition{URI: "k8s-readonly://namespaces/" + namespace, Name: namespace, Description: "Read-only Kubernetes namespace scope", MimeType: "application/json", Text: `{"namespace":"` + namespace + `"}`})
	}
	return resources
}

func knownNamespace(namespaces []string, namespace string) bool {
	for _, item := range namespaces {
		if item == namespace {
			return true
		}
	}
	return false
}
