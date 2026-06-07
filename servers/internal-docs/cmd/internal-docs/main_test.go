package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestInternalDocsSearchAppliesDLP(t *testing.T) {
	handler := server().Handler()
	body, _ := json.Marshal(map[string]interface{}{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": map[string]interface{}{"name": "search_docs", "arguments": map[string]interface{}{"query": "lease"}}})
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/mcp", bytes.NewReader(body)))
	if recorder.Code != http.StatusOK || bytes.Contains(recorder.Body.Bytes(), []byte("credentials")) || !bytes.Contains(recorder.Body.Bytes(), []byte("[redacted]")) {
		t.Fatalf("expected DLP-redacted response, got %d %s", recorder.Code, recorder.Body.String())
	}
}
