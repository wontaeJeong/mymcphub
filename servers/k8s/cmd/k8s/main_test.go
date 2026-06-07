package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestK8sServerEnforcesNamespaceScope(t *testing.T) {
	t.Setenv("K8S_ALLOWED_NAMESPACES", "platform")
	handler := newServer().Handler()
	list := postRPC(t, handler, map[string]interface{}{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": map[string]interface{}{"name": "list_namespaces", "arguments": map[string]interface{}{}}})
	if !bytes.Contains(list.Body.Bytes(), []byte("platform")) || bytes.Contains(list.Body.Bytes(), []byte("observability")) {
		t.Fatalf("namespace scope leaked: %s", list.Body.String())
	}
	denied := postRPC(t, handler, map[string]interface{}{"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": map[string]interface{}{"name": "list_pods", "arguments": map[string]interface{}{"namespace": "default"}}})
	if !bytes.Contains(denied.Body.Bytes(), []byte("Namespace is outside")) {
		t.Fatalf("expected namespace denial, got %s", denied.Body.String())
	}
}

func postRPC(t *testing.T, handler http.Handler, body map[string]interface{}) *httptest.ResponseRecorder {
	t.Helper()
	encoded, _ := json.Marshal(body)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/mcp", bytes.NewReader(encoded)))
	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status %d body %s", recorder.Code, recorder.Body.String())
	}
	return recorder
}
