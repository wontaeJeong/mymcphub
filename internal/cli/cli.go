package cli

import (
	"bytes"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
)

type Options struct {
	APIURL     string
	Profile    string
	Output     string
	DryRun     bool
	Yes        bool
	Token      string
	ConfigPath string
	Writer     io.Writer
	ErrWriter  io.Writer
	HTTPClient *http.Client
	Args       []string
}

func Main(args []string) int {
	return Run(Options{Args: args, Writer: os.Stdout, ErrWriter: os.Stderr, HTTPClient: http.DefaultClient})
}

func Run(opts Options) int {
	if opts.Writer == nil {
		opts.Writer = io.Discard
	}
	if opts.ErrWriter == nil {
		opts.ErrWriter = io.Discard
	}
	if opts.HTTPClient == nil {
		opts.HTTPClient = http.DefaultClient
	}
	if opts.ConfigPath == "" {
		opts.ConfigPath = filepath.Join(userHome(), ".config", "mcphubctl", "config.yaml")
	}
	config := readConfig(opts.ConfigPath)
	if opts.APIURL == "" {
		opts.APIURL = config.APIURL
	}
	if opts.APIURL == "" {
		opts.APIURL = "http://localhost:4000"
	}
	if opts.Profile == "" {
		opts.Profile = config.Profile
	}
	if opts.Token == "" {
		opts.Token = first(os.Getenv("MCPHUB_TOKEN"), config.Token)
	}
	if opts.Output == "" {
		opts.Output = "table"
	}

	flags := flag.NewFlagSet("mcphubctl", flag.ContinueOnError)
	flags.SetOutput(opts.ErrWriter)
	flags.StringVar(&opts.APIURL, "api-url", opts.APIURL, "Control Plane API URL")
	flags.StringVar(&opts.Profile, "profile", opts.Profile, "config profile")
	flags.StringVar(&opts.Output, "output", opts.Output, "table, json, or yaml")
	flags.BoolVar(&opts.DryRun, "dry-run", opts.DryRun, "print planned mutation without executing")
	flags.BoolVar(&opts.Yes, "yes", opts.Yes, "confirm non-interactively")
	flags.Usage = func() { usage(opts.Writer) }
	if err := flags.Parse(opts.Args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return 0
		}
		return exit(opts, 2, "CLI_USAGE_ERROR", err.Error())
	}
	args := flags.Args()
	if len(args) == 0 || args[0] == "help" || args[0] == "--help" {
		usage(opts.Writer)
		return 0
	}

	client := Client{BaseURL: strings.TrimRight(opts.APIURL, "/"), HTTPClient: opts.HTTPClient, Output: opts.Output, Writer: opts.Writer, DryRun: opts.DryRun, Token: opts.Token}
	status, err := dispatch(client, opts, args)
	if err != nil {
		return exit(opts, status, codeFor(err), err.Error())
	}
	return status
}

type Client struct {
	BaseURL    string
	HTTPClient *http.Client
	Output     string
	Writer     io.Writer
	DryRun     bool
	Token      string
}
type configFile struct {
	APIURL  string
	Profile string
	Token   string
}

func dispatch(client Client, opts Options, args []string) (int, error) {
	switch args[0] {
	case "version":
		return printValue(client, map[string]string{"version": "0.1.0", "component": "mcphubctl"})
	case "login":
		return login(opts, client, args[1:])
	case "logout":
		return logout(opts)
	case "whoami":
		return client.get("/api/me")
	case "health", "doctor":
		return client.get("/healthz")
	case "completion":
		return completion(opts.Writer, args[1:])
	case "server":
		return serverCommand(client, args[1:])
	case "tool":
		return toolCommand(client, args[1:])
	case "grant":
		return grantCommand(client, args[1:])
	case "policy":
		return policyCommand(client, args[1:])
	case "audit":
		return auditCommand(client, args[1:])
	case "client":
		return clientCommand(client, args[1:])
	default:
		return 2, fmt.Errorf("unknown command %s", args[0])
	}
}

func serverCommand(client Client, args []string) (int, error) {
	if len(args) == 0 {
		return 2, errors.New("server command required")
	}
	switch args[0] {
	case "list":
		return client.get("/api/servers")
	case "get":
		return requireArg(args, 1, func(id string) (int, error) { return client.get("/api/servers/" + id) })
	case "register":
		file := flagValue(args[1:], "-f")
		if file == "" {
			return 2, errors.New("server register requires -f")
		}
		return client.postFile("/api/servers", file)
	case "scan":
		return requireArg(args, 1, func(id string) (int, error) {
			return printValue(client, map[string]string{"server": id, "status": "scan requested through Control Plane API"})
		})
	case "diff":
		return requireArg(args, 1, func(id string) (int, error) { return client.get("/api/servers/" + id + "/schema-diff") })
	case "publish", "unpublish", "disable", "quarantine":
		return requireArg(args, 1, func(id string) (int, error) { return client.post("/api/servers/"+id+"/"+args[0], nil) })
	default:
		return 2, fmt.Errorf("unknown server command %s", args[0])
	}
}

func toolCommand(client Client, args []string) (int, error) {
	if len(args) == 0 {
		return 2, errors.New("tool command required")
	}
	switch args[0] {
	case "list":
		return requireArg(args, 1, func(server string) (int, error) { return client.get("/api/servers/" + server + "/tools") })
	case "get":
		if len(args) < 3 {
			return 2, errors.New("tool get requires <server> <tool>")
		}
		return client.get("/api/servers/" + args[1] + "/tools/" + args[2] + "/schema")
	case "test":
		if len(args) < 3 {
			return 2, errors.New("tool test requires <server> <tool>")
		}
		file := flagValue(args[3:], "-f")
		payload := map[string]interface{}{"server": args[1], "tool": args[2], "payloadFile": file, "dryRun": true}
		return printValue(client, payload)
	default:
		return 2, fmt.Errorf("unknown tool command %s", args[0])
	}
}

func grantCommand(client Client, args []string) (int, error) {
	if len(args) == 0 {
		return 2, errors.New("grant command required")
	}
	switch args[0] {
	case "list":
		return client.get("/api/grants")
	case "request":
		file := flagValue(args[1:], "-f")
		if file == "" {
			return 2, errors.New("grant request requires -f")
		}
		return client.postFile("/api/grants", file)
	case "approve", "revoke":
		return requireArg(args, 1, func(id string) (int, error) { return client.post("/api/grants/"+id+"/"+args[0], nil) })
	default:
		return 2, fmt.Errorf("unknown grant command %s", args[0])
	}
}
func policyCommand(client Client, args []string) (int, error) {
	if len(args) == 0 {
		return 2, errors.New("policy command required")
	}
	switch args[0] {
	case "validate":
		file := flagValue(args[1:], "-f")
		if file == "" {
			return 2, errors.New("policy validate requires -f")
		}
		return client.postFile("/api/policy/validate", file)
	case "simulate":
		file := flagValue(args[1:], "-f")
		if file == "" {
			return 2, errors.New("policy simulate requires -f")
		}
		return client.postFile("/api/policy/simulate", file)
	case "test-call":
		file := flagValue(args[1:], "-f")
		if file == "" {
			return 2, errors.New("policy test-call requires -f")
		}
		return client.postFile("/api/policy/test-call", file)
	default:
		return 2, fmt.Errorf("unknown policy command %s", args[0])
	}
}
func auditCommand(client Client, args []string) (int, error) {
	if len(args) == 0 {
		return 2, errors.New("audit command required")
	}
	switch args[0] {
	case "search":
		return client.get("/api/audit-events" + query(args[1:]))
	case "export":
		if valueAfter(args[1:], "--from") == "" || valueAfter(args[1:], "--to") == "" {
			return 2, errors.New("audit export requires --from and --to")
		}
		return client.get("/api/audit-events/export" + query(args[1:]))
	default:
		return 2, fmt.Errorf("unknown audit command %s", args[0])
	}
}
func clientCommand(client Client, args []string) (int, error) {
	if len(args) == 0 {
		return 2, errors.New("client command required")
	}
	switch args[0] {
	case "config":
		profile := valueAfter(args, "--profile")
		if profile == "" {
			profile = "local"
		}
		body := map[string]interface{}{"client": valueAfter(args, "--client"), "profile": profile, "serverId": valueAfter(args, "--server")}
		if body["client"] == "" {
			body["client"] = "opencode"
		}
		if body["serverId"] == "" {
			body["serverId"] = "00000000-0000-4000-8000-000000000100"
		}
		return client.post("/api/client-config/generate", body)
	case "test":
		server := valueAfter(args, "--server")
		if server == "" && len(args) > 1 {
			server = args[1]
		}
		if server == "" {
			server = "k8s-readonly"
		}
		gatewayURL := valueAfter(args, "--gateway-url")
		if gatewayURL == "" {
			return printValue(client, map[string]string{"server": server, "status": "client connectivity check requires --gateway-url"})
		}
		token := valueAfter(args, "--token")
		if token == "" {
			token = client.Token
		}
		return testGatewayClient(client, gatewayURL, server, token)
	default:
		return 2, fmt.Errorf("unknown client command %s", args[0])
	}
}

func testGatewayClient(client Client, gatewayURL string, server string, token string) (int, error) {
	body := map[string]interface{}{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}
	encoded, _ := json.Marshal(body)
	url := strings.TrimRight(gatewayURL, "/")
	if !strings.Contains(url, "/mcp/") {
		url += "/mcp/" + server
	}
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(encoded))
	if err != nil {
		return 1, err
	}
	req.Header.Set("content-type", "application/json")
	if token != "" {
		req.Header.Set("authorization", "Bearer "+token)
	}
	resp, err := client.HTTPClient.Do(req)
	if err != nil {
		return 1, err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return 1, fmt.Errorf("gateway request failed: %s", strings.TrimSpace(string(data)))
	}
	var value map[string]interface{}
	_ = json.Unmarshal(data, &value)
	result, _ := value["result"].(map[string]interface{})
	tools, _ := result["tools"].([]interface{})
	return printValue(client, map[string]interface{}{"server": server, "gatewayUrl": url, "status": "ok", "toolCount": len(tools)})
}

func (c Client) get(path string) (int, error) { return c.request(http.MethodGet, path, nil) }
func (c Client) post(path string, body interface{}) (int, error) {
	return c.request(http.MethodPost, path, body)
}
func (c Client) postFile(path, file string) (int, error) {
	data, err := os.ReadFile(file)
	if err != nil {
		return 1, err
	}
	var body interface{}
	if err := json.Unmarshal(data, &body); err != nil {
		body = map[string]interface{}{"raw": string(data)}
	}
	return c.post(path, body)
}
func (c Client) request(method, path string, body interface{}) (int, error) {
	if c.DryRun && method != http.MethodGet {
		return printValue(c, map[string]interface{}{"dryRun": true, "method": method, "path": path})
	}
	var reader io.Reader
	if body != nil {
		encoded, _ := json.Marshal(body)
		reader = bytes.NewReader(encoded)
	}
	req, err := http.NewRequest(method, c.BaseURL+path, reader)
	if err != nil {
		return 1, err
	}
	if body != nil {
		req.Header.Set("content-type", "application/json")
	}
	if c.Token != "" {
		req.Header.Set("authorization", "Bearer "+c.Token)
	}
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return 1, err
	}
	defer resp.Body.Close()
	var value interface{}
	data, _ := io.ReadAll(resp.Body)
	if len(data) > 0 {
		_ = json.Unmarshal(data, &value)
	}
	if resp.StatusCode >= 400 {
		return 1, fmt.Errorf("api request failed: %s", strings.TrimSpace(string(data)))
	}
	return printValue(c, value)
}

func printValue(c Client, value interface{}) (int, error) {
	switch c.Output {
	case "json":
		encoded, _ := json.MarshalIndent(value, "", "  ")
		fmt.Fprintln(c.Writer, string(encoded))
	case "yaml":
		printYAML(c.Writer, value, 0)
	default:
		printTable(c.Writer, value)
	}
	return 0, nil
}
func printTable(w io.Writer, value interface{}) {
	encoded, _ := json.Marshal(value)
	fmt.Fprintln(w, string(encoded))
}
func printYAML(w io.Writer, value interface{}, indent int) {
	switch typed := value.(type) {
	case map[string]interface{}:
		for key, item := range typed {
			fmt.Fprintf(w, "%s%s: ", strings.Repeat(" ", indent), key)
			switch item.(type) {
			case map[string]interface{}, []interface{}:
				fmt.Fprintln(w)
				printYAML(w, item, indent+2)
			default:
				fmt.Fprintf(w, "%v\n", item)
			}
		}
	case []interface{}:
		for _, item := range typed {
			fmt.Fprintf(w, "%s- ", strings.Repeat(" ", indent))
			switch item.(type) {
			case map[string]interface{}, []interface{}:
				fmt.Fprintln(w)
				printYAML(w, item, indent+2)
			default:
				fmt.Fprintf(w, "%v\n", item)
			}
		}
	default:
		fmt.Fprintf(w, "%s%v\n", strings.Repeat(" ", indent), typed)
	}
}

func login(opts Options, client Client, args []string) (int, error) {
	token := valueAfter(args, "--token")
	if token == "" {
		token = "dev-admin-token"
	}
	if err := os.MkdirAll(filepath.Dir(opts.ConfigPath), 0o700); err != nil {
		return 1, err
	}
	content := fmt.Sprintf("profile: %s\napiUrl: %s\ntoken: %s\n", first(opts.Profile, "local"), client.BaseURL, token)
	if err := os.WriteFile(opts.ConfigPath, []byte(content), 0o600); err != nil {
		return 1, err
	}
	fmt.Fprintln(opts.Writer, "logged in")
	return 0, nil
}
func logout(opts Options) (int, error) {
	if err := os.Remove(opts.ConfigPath); err != nil && !errors.Is(err, os.ErrNotExist) {
		return 1, err
	}
	fmt.Fprintln(opts.Writer, "logged out")
	return 0, nil
}
func completion(w io.Writer, args []string) (int, error) {
	shell := "bash"
	if len(args) > 0 {
		shell = args[0]
	}
	fmt.Fprintf(w, "# mcphubctl %s completion\ncomplete -W 'login logout whoami server tool grant policy audit client health doctor version completion' mcphubctl\n", shell)
	return 0, nil
}

func readConfig(path string) configFile {
	data, err := os.ReadFile(path)
	if err != nil {
		return configFile{}
	}
	cfg := configFile{}
	for _, line := range strings.Split(string(data), "\n") {
		key, value, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		value = strings.TrimSpace(value)
		switch strings.TrimSpace(key) {
		case "apiUrl":
			cfg.APIURL = value
		case "profile":
			cfg.Profile = value
		case "token":
			cfg.Token = value
		}
	}
	return cfg
}
func usage(w io.Writer) {
	fmt.Fprintln(w, "mcphubctl [--api-url URL] [--profile NAME] [--output table|json|yaml] <command>")
}
func exit(opts Options, code int, errCode, message string) int {
	if opts.Output == "json" {
		encoded, _ := json.Marshal(map[string]interface{}{"error": map[string]string{"code": errCode, "message": message}})
		fmt.Fprintln(opts.ErrWriter, string(encoded))
	} else {
		fmt.Fprintf(opts.ErrWriter, "%s: %s\n", errCode, message)
	}
	return code
}
func codeFor(err error) string {
	if strings.Contains(err.Error(), "unknown") || strings.Contains(err.Error(), "requires") {
		return "CLI_USAGE_ERROR"
	}
	return "MCPHUBCTL_ERROR"
}
func requireArg(args []string, index int, fn func(string) (int, error)) (int, error) {
	if len(args) <= index {
		return 2, errors.New("missing required argument")
	}
	return fn(args[index])
}
func flagValue(args []string, flag string) string {
	for i, arg := range args {
		if arg == flag && i+1 < len(args) {
			return args[i+1]
		}
	}
	return ""
}
func valueAfter(args []string, flag string) string { return flagValue(args, flag) }
func first(value, fallback string) string {
	if value != "" {
		return value
	}
	return fallback
}
func userHome() string {
	if home, err := os.UserHomeDir(); err == nil {
		return home
	}
	return "."
}
func query(args []string) string {
	params := url.Values{}
	keyMap := map[string]string{"from": "from", "to": "to", "user": "user", "team": "team", "project": "project", "server": "server", "tool": "tool", "event-type": "event_type", "policy-decision": "policy_decision", "risk-level": "risk_level", "trace-id": "trace_id", "limit": "limit", "cursor": "cursor", "redacted": "redacted", "signed": "signed"}
	for i := 0; i < len(args); i++ {
		if !strings.HasPrefix(args[i], "--") {
			continue
		}
		key := strings.TrimPrefix(args[i], "--")
		queryKey, ok := keyMap[key]
		if !ok {
			continue
		}
		if key == "signed" || key == "redacted" {
			params.Set(queryKey, "true")
			continue
		}
		if i+1 < len(args) {
			if strings.HasPrefix(args[i+1], "--") {
				continue
			}
			params.Set(queryKey, args[i+1])
			i++
		}
	}
	if len(params) == 0 {
		return ""
	}
	return "?" + params.Encode()
}
