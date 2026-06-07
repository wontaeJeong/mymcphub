package mcp

import (
	"encoding/json"
	"errors"
)

type ID interface{}

type Request struct {
	JSONRPC string                 `json:"jsonrpc"`
	ID      ID                     `json:"id,omitempty"`
	Method  string                 `json:"method"`
	Params  map[string]interface{} `json:"params,omitempty"`
}
type Response struct {
	JSONRPC string                 `json:"jsonrpc"`
	ID      ID                     `json:"id"`
	Result  map[string]interface{} `json:"result,omitempty"`
	Error   *RPCError              `json:"error,omitempty"`
}
type RPCError struct {
	Code    int                    `json:"code"`
	Message string                 `json:"message"`
	Data    map[string]interface{} `json:"data,omitempty"`
}

var ErrInvalidRequest = errors.New("invalid JSON-RPC request")

func ParseRequest(value interface{}) (Request, error) {
	var raw map[string]interface{}
	switch typed := value.(type) {
	case []byte:
		if err := json.Unmarshal(typed, &raw); err != nil {
			return Request{}, err
		}
	case map[string]interface{}:
		raw = typed
	default:
		encoded, err := json.Marshal(value)
		if err != nil {
			return Request{}, err
		}
		if err := json.Unmarshal(encoded, &raw); err != nil {
			return Request{}, err
		}
	}
	method, _ := raw["method"].(string)
	if raw["jsonrpc"] != "2.0" || method == "" {
		return Request{}, ErrInvalidRequest
	}
	params, _ := raw["params"].(map[string]interface{})
	return Request{JSONRPC: "2.0", ID: raw["id"], Method: method, Params: params}, nil
}

func Result(id ID, payload map[string]interface{}) Response {
	if id == nil {
		id = nil
	}
	return Response{JSONRPC: "2.0", ID: idOrNull(id), Result: payload}
}
func Error(id ID, code int, message string) Response {
	return Response{JSONRPC: "2.0", ID: idOrNull(id), Error: &RPCError{Code: code, Message: message}}
}
func idOrNull(id ID) ID {
	if id == nil {
		return nil
	}
	return id
}
