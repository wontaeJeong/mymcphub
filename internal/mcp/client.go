package mcp

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os/exec"
	"strings"
	"sync/atomic"
	"time"

	"github.com/mcp-hub/mcp-hub/internal/db"
)

type Client struct {
	HTTPClient *http.Client
	Timeout    time.Duration
	MaxBytes   int64
}
type rpcReq struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      int64       `json:"id,omitempty"`
	Method  string      `json:"method"`
	Params  interface{} `json:"params,omitempty"`
}
type rpcResp struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      int64           `json:"id,omitempty"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *rpcError       `json:"error,omitempty"`
}
type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

var ids atomic.Int64

func (c Client) SyncStreamableHTTP(ctx context.Context, endpoint string) (db.CapabilitySnapshot, error) {
	if endpoint == "" {
		return db.CapabilitySnapshot{}, errors.New("endpoint_url is required")
	}
	if ctx == nil {
		ctx = context.Background()
	}
	ctx, cancel := context.WithTimeout(ctx, c.timeout())
	defer cancel()
	call := func(method string, params interface{}) (json.RawMessage, error) {
		return c.httpCall(ctx, endpoint, method, params)
	}
	notify := func(method string, params interface{}) error {
		return c.httpNotify(ctx, endpoint, method, params)
	}
	return collect(call, notify, "streamable_http_worker")
}

func (c Client) HealthStreamableHTTP(ctx context.Context, endpoint string) (string, int64, string) {
	start := time.Now()
	_, err := c.SyncStreamableHTTP(ctx, endpoint)
	lat := time.Since(start).Milliseconds()
	if err != nil {
		return "offline", lat, err.Error()
	}
	return "healthy", lat, ""
}

func (c Client) SyncStdio(ctx context.Context, command string, args []string, env []string) (db.CapabilitySnapshot, error) {
	if command == "" {
		return db.CapabilitySnapshot{}, errors.New("stdio command is required")
	}
	if ctx == nil {
		ctx = context.Background()
	}
	ctx, cancel := context.WithTimeout(ctx, c.timeout())
	defer cancel()
	cmd := exec.CommandContext(ctx, command, args...)
	cmd.Env = env
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return db.CapabilitySnapshot{}, err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return db.CapabilitySnapshot{}, err
	}
	var stderr limitedBuffer
	cmd.Stderr = &stderr
	if err := cmd.Start(); err != nil {
		return db.CapabilitySnapshot{}, err
	}
	reader := bufio.NewReader(io.LimitReader(stdout, c.maxBytes()))
	call := func(method string, params interface{}) (json.RawMessage, error) {
		id := ids.Add(1)
		if err := json.NewEncoder(stdin).Encode(rpcReq{JSONRPC: "2.0", ID: id, Method: method, Params: params}); err != nil {
			return nil, err
		}
		for {
			line, err := reader.ReadBytes('\n')
			if err != nil {
				return nil, fmt.Errorf("stdio read failed: %w %s", err, strings.TrimSpace(stderr.String()))
			}
			var resp rpcResp
			if json.Unmarshal(bytes.TrimSpace(line), &resp) != nil {
				continue
			}
			if resp.ID != id {
				continue
			}
			if resp.Error != nil {
				return nil, fmt.Errorf("%s: %s", method, resp.Error.Message)
			}
			return resp.Result, nil
		}
	}
	notify := func(method string, params interface{}) error {
		return json.NewEncoder(stdin).Encode(rpcReq{JSONRPC: "2.0", Method: method, Params: params})
	}
	snap, err := collect(call, notify, "stdio_cli")
	_ = stdin.Close()
	_ = cmd.Process.Kill()
	_ = cmd.Wait()
	return snap, err
}

func collect(call func(string, interface{}) (json.RawMessage, error), notify func(string, interface{}) error, source string) (db.CapabilitySnapshot, error) {
	initParams := map[string]interface{}{"protocolVersion": "2024-11-05", "capabilities": map[string]interface{}{}, "clientInfo": map[string]interface{}{"name": "mcphub", "version": "0.1.0"}}
	raw, err := call("initialize", initParams)
	if err != nil {
		return db.CapabilitySnapshot{}, err
	}
	var init map[string]interface{}
	_ = json.Unmarshal(raw, &init)
	if notify != nil {
		_ = notify("notifications/initialized", nil)
	}
	snap := db.CapabilitySnapshot{Source: source, CapturedAt: time.Now().UTC(), RawInitialize: init, ProtocolVersion: str(init["protocolVersion"]), ServerInfo: obj(init["serverInfo"]), Capabilities: obj(init["capabilities"])}
	snap.Tools, err = list(call, "tools/list", "tools", &snap)
	if err != nil {
		return db.CapabilitySnapshot{}, err
	}
	snap.Resources, err = list(call, "resources/list", "resources", &snap)
	if err != nil {
		return db.CapabilitySnapshot{}, err
	}
	snap.Prompts, err = list(call, "prompts/list", "prompts", &snap)
	if err != nil {
		return db.CapabilitySnapshot{}, err
	}
	snap.SnapshotHash = db.SnapshotHash(snap)
	return snap, nil
}

func list(call func(string, interface{}) (json.RawMessage, error), method, key string, snap *db.CapabilitySnapshot) ([]map[string]interface{}, error) {
	raw, err := call(method, nil)
	if err != nil {
		msg := err.Error()
		if strings.Contains(msg, "not found") || strings.Contains(msg, "Method not found") || strings.Contains(msg, "-32601") {
			snap.Warnings = append(snap.Warnings, method+" unsupported")
			return []map[string]interface{}{}, nil
		}
		return nil, err
	}
	var envelope map[string]json.RawMessage
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return nil, err
	}
	return arr(envelope[key]), nil
}

func (c Client) httpNotify(ctx context.Context, endpoint, method string, params interface{}) error {
	body, _ := json.Marshal(rpcReq{JSONRPC: "2.0", Method: method, Params: params})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("content-type", "application/json")
	req.Header.Set("accept", "application/json, text/event-stream")
	hc := c.HTTPClient
	if hc == nil {
		hc = &http.Client{}
	}
	res, err := hc.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode/100 != 2 {
		return fmt.Errorf("%s returned HTTP %d", method, res.StatusCode)
	}
	_, _ = io.Copy(io.Discard, io.LimitReader(res.Body, c.maxBytes()))
	return nil
}

func (c Client) httpCall(ctx context.Context, endpoint, method string, params interface{}) (json.RawMessage, error) {
	id := ids.Add(1)
	body, _ := json.Marshal(rpcReq{JSONRPC: "2.0", ID: id, Method: method, Params: params})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("content-type", "application/json")
	req.Header.Set("accept", "application/json, text/event-stream")
	hc := c.HTTPClient
	if hc == nil {
		hc = &http.Client{}
	}
	res, err := hc.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode/100 != 2 {
		return nil, fmt.Errorf("%s returned HTTP %d", method, res.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(res.Body, c.maxBytes()))
	if err != nil {
		return nil, err
	}
	var resp rpcResp
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, err
	}
	if resp.Error != nil {
		return nil, fmt.Errorf("%s: %s", method, resp.Error.Message)
	}
	return resp.Result, nil
}
func (c Client) timeout() time.Duration {
	if c.Timeout > 0 {
		return c.Timeout
	}
	return 20 * time.Second
}
func (c Client) maxBytes() int64 {
	if c.MaxBytes > 0 {
		return c.MaxBytes
	}
	return 4 << 20
}
func str(v interface{}) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}
func obj(v interface{}) map[string]interface{} {
	if m, ok := v.(map[string]interface{}); ok {
		return m
	}
	return map[string]interface{}{}
}
func arr(raw json.RawMessage) []map[string]interface{} {
	var a []map[string]interface{}
	_ = json.Unmarshal(raw, &a)
	if a == nil {
		return []map[string]interface{}{}
	}
	return a
}

type limitedBuffer struct{ bytes.Buffer }

func (b *limitedBuffer) Write(p []byte) (int, error) {
	if b.Buffer.Len() >= 4096 {
		return len(p), nil
	}
	if b.Buffer.Len()+len(p) > 4096 {
		p = p[:4096-b.Buffer.Len()]
	}
	return b.Buffer.Write(p)
}
