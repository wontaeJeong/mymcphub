package main

import (
	"bufio"
	"encoding/json"
	"os"
)

type req struct {
	JSONRPC string `json:"jsonrpc"`
	ID      int    `json:"id"`
	Method  string `json:"method"`
}

func main() {
	s := bufio.NewScanner(os.Stdin)
	enc := json.NewEncoder(os.Stdout)
	for s.Scan() {
		var r req
		if json.Unmarshal(s.Bytes(), &r) != nil {
			continue
		}
		result := map[string]interface{}{}
		switch r.Method {
		case "initialize":
			result = map[string]interface{}{"protocolVersion": "2024-11-05", "serverInfo": map[string]interface{}{"name": "mock-stdio", "version": "0.1.0"}, "capabilities": map[string]interface{}{"tools": map[string]interface{}{}}}
		case "tools/list":
			result = map[string]interface{}{"tools": []map[string]interface{}{{"name": "ping", "title": "Ping", "description": "테스트 도구", "inputSchema": map[string]interface{}{"type": "object"}}}}
		case "resources/list":
			result = map[string]interface{}{"resources": []map[string]interface{}{}}
		case "prompts/list":
			result = map[string]interface{}{"prompts": []map[string]interface{}{}}
		case "notifications/initialized":
			continue
		default:
			enc.Encode(map[string]interface{}{"jsonrpc": "2.0", "id": r.ID, "error": map[string]interface{}{"code": -32601, "message": "Method not found"}})
			continue
		}
		enc.Encode(map[string]interface{}{"jsonrpc": "2.0", "id": r.ID, "result": result})
	}
}
