package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestGitHubReadonlyToolsListAndScopedPR(t *testing.T) {
	handler := server().Handler()
	list := postGitHubRPC(t, handler, map[string]interface{}{"jsonrpc": "2.0", "id": 1, "method": "tools/list"})
	if !bytes.Contains(list.Body.Bytes(), []byte("list_repositories")) || !bytes.Contains(list.Body.Bytes(), []byte("readOnlyHint")) {
		t.Fatalf("expected readonly tool descriptors, got %s", list.Body.String())
	}
	call := postGitHubRPC(t, handler, map[string]interface{}{"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": map[string]interface{}{"name": "get_pull_request", "arguments": map[string]interface{}{"repository": "platform/mcp-hub", "number": 1}}})
	if !bytes.Contains(call.Body.Bytes(), []byte("Runtime manifest review")) {
		t.Fatalf("expected scoped PR response, got %s", call.Body.String())
	}
}

func postGitHubRPC(t *testing.T, handler http.Handler, body map[string]interface{}) *httptest.ResponseRecorder {
	t.Helper()
	encoded, _ := json.Marshal(body)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/mcp", bytes.NewReader(encoded)))
	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status %d body %s", recorder.Code, recorder.Body.String())
	}
	return recorder
}
