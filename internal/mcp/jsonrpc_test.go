package mcp

import (
	"encoding/json"
	"errors"
	"testing"
)

func TestParseRequestAcceptsMCPJSONRPCShape(t *testing.T) {
	request, err := ParseRequest([]byte(`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_namespaces","arguments":{}}}`))
	if err != nil {
		t.Fatalf("parse request: %v", err)
	}
	if request.JSONRPC != "2.0" || request.Method != "tools/call" {
		t.Fatalf("unexpected request shape: %#v", request)
	}
	if request.Params["name"] != "list_namespaces" {
		t.Fatalf("expected tool name param, got %#v", request.Params)
	}
}

func TestParseRequestRejectsInvalidJSONRPCShape(t *testing.T) {
	_, err := ParseRequest(map[string]interface{}{"jsonrpc": "2.0", "id": 1})
	if !errors.Is(err, ErrInvalidRequest) {
		t.Fatalf("expected invalid request error, got %v", err)
	}
}

func TestResponseHelpersPreserveJSONRPCEnvelope(t *testing.T) {
	result := Result("request-1", map[string]interface{}{"ok": true})
	encoded, err := json.Marshal(result)
	if err != nil {
		t.Fatal(err)
	}
	if string(encoded) != `{"jsonrpc":"2.0","id":"request-1","result":{"ok":true}}` {
		t.Fatalf("unexpected result envelope: %s", encoded)
	}

	rpcError := Error(nil, -32600, "Invalid Request")
	encoded, err = json.Marshal(rpcError)
	if err != nil {
		t.Fatal(err)
	}
	if string(encoded) != `{"jsonrpc":"2.0","id":null,"error":{"code":-32600,"message":"Invalid Request"}}` {
		t.Fatalf("unexpected error envelope: %s", encoded)
	}
}
