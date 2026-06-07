package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/mcp-hub/mcp-hub/internal/mcp"
)

type adapter struct {
	command []string
	timeout time.Duration
}

func main() {
	port := 5110
	if value := os.Getenv("PORT"); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil {
			port = parsed
		}
	}
	log.Fatal(http.ListenAndServe(":"+strconv.Itoa(port), newAdapterFromEnv().handler()))
}

func newAdapterFromEnv() adapter {
	command := []string{}
	if value := strings.TrimSpace(os.Getenv("STDIO_COMMAND")); value != "" {
		command = append(command, value)
	}
	if value := strings.TrimSpace(os.Getenv("STDIO_ARGS")); value != "" {
		command = append(command, splitArgs(value)...)
	}
	timeout := 2 * time.Second
	if value := os.Getenv("REQUEST_TIMEOUT_MS"); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil && parsed > 0 {
			timeout = time.Duration(parsed) * time.Millisecond
		}
	}
	return adapter{command: command, timeout: timeout}
}

func (a adapter) handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		status := "ready"
		if len(a.command) == 0 {
			status = "config_missing"
		}
		writeJSON(w, 200, map[string]interface{}{"status": status, "adapter": "stdio-to-streamable-http", "timeoutMs": int(a.timeout / time.Millisecond)})
	})
	mux.HandleFunc("/mcp", func(w http.ResponseWriter, r *http.Request) {
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
		response, err := a.call(r.Context(), request)
		if err != nil {
			writeJSON(w, 503, mcp.Error(request.ID, -32003, err.Error()))
			return
		}
		writeJSON(w, 200, response)
	})
	return mux
}

func (a adapter) call(ctx context.Context, request mcp.Request) (mcp.Response, error) {
	if len(a.command) == 0 {
		return mcp.Response{}, errors.New("STDIO_COMMAND is required")
	}
	ctx, cancel := context.WithTimeout(ctx, a.timeout)
	defer cancel()
	encoded, _ := json.Marshal(request)
	cmd := exec.CommandContext(ctx, a.command[0], a.command[1:]...)
	cmd.Stdin = bytes.NewReader(append(encoded, '\n'))
	var stdout bytes.Buffer
	cmd.Stdout = &stdout
	if err := cmd.Run(); err != nil {
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return mcp.Response{}, errors.New("STDIO_ADAPTER_TIMEOUT")
		}
		return mcp.Response{}, errors.New("STDIO_ADAPTER_SUBPROCESS_FAILED")
	}
	var response mcp.Response
	if err := json.Unmarshal(bytes.TrimSpace(stdout.Bytes()), &response); err != nil || response.JSONRPC != "2.0" {
		return mcp.Response{}, errors.New("STDIO_ADAPTER_INVALID_STDOUT_JSON_RPC")
	}
	return response, nil
}

func splitArgs(value string) []string {
	parts := []string{}
	for _, item := range strings.Split(value, " ") {
		item = strings.TrimSpace(item)
		if item != "" {
			parts = append(parts, item)
		}
	}
	return parts
}

func writeJSON(w http.ResponseWriter, status int, value interface{}) {
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
