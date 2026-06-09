package cli

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/mcp-hub/mcp-hub/internal/db"
	"github.com/mcp-hub/mcp-hub/internal/mcp"
)

type ConfigFile struct {
	APIURL string `json:"apiUrl"`
	Token  string `json:"token"`
}

func Main(args []string) int {
	if err := Run(args, os.Stdout, os.Stderr); err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	return 0
}
func Run(args []string, out, errw io.Writer) error {
	c := load()
	output := "table"
	if v := env("MCPHUB_API_URL", ""); v != "" {
		c.APIURL = v
	}
	if v := env("MCPHUB_TOKEN", ""); v != "" {
		c.Token = v
	}
	args = stripGlobal(args, &c, &output)
	if len(args) == 0 {
		return help(out)
	}
	switch args[0] {
	case "login":
		return login(args[1:], out)
	case "logout":
		return logout(out)
	case "whoami":
		return print(out, output, map[string]interface{}{"apiUrl": c.APIURL, "authenticated": c.Token != ""})
	case "health":
		return request(c, http.MethodGet, "/healthz", nil, out)
	case "version":
		_, err := fmt.Fprintln(out, "mcphubctl 0.1.0")
		return err
	case "server":
		return server(c, args[1:], out)
	case "snapshot":
		if len(args) >= 3 && args[1] == "get" {
			return request(c, http.MethodGet, "/api/servers/"+args[2]+"/capability-snapshot", nil, out)
		}
	case "audit":
		path := "/api/admin/audit-events"
		if s := valueAfter(args, "--server"); s != "" {
			path += "?server=" + s
		}
		return request(c, http.MethodGet, path, nil, out)
	}
	return fmt.Errorf("unknown command %s", args[0])
}
func help(out io.Writer) error {
	_, err := fmt.Fprintln(out, "mcphubctl login|logout|whoami|server|snapshot|audit|health|version")
	return err
}
func server(c ConfigFile, args []string, out io.Writer) error {
	if len(args) == 0 {
		return errors.New("server command required")
	}
	switch args[0] {
	case "list":
		return request(c, http.MethodGet, "/api/servers", nil, out)
	case "get":
		if len(args) < 2 {
			return errors.New("server get requires id or slug")
		}
		return request(c, http.MethodGet, "/api/servers/"+args[1], nil, out)
	case "register":
		f := valueAfter(args, "-f")
		if f == "" {
			return errors.New("server register requires -f")
		}
		body, err := manifest(f)
		if err != nil {
			return err
		}
		return request(c, http.MethodPost, "/api/admin/servers", body, out)
	case "update":
		if len(args) < 2 {
			return errors.New("server update requires id or slug")
		}
		f := valueAfter(args, "-f")
		body, err := manifest(f)
		if err != nil {
			return err
		}
		return request(c, http.MethodPatch, "/api/admin/servers/"+args[1], body, out)
	case "delete":
		if len(args) < 2 {
			return errors.New("server delete requires id or slug")
		}
		if !has(args, "--yes") {
			return errors.New("server delete requires --yes")
		}
		return request(c, http.MethodDelete, "/api/admin/servers/"+args[1], nil, out)
	case "sync":
		if len(args) < 2 {
			return errors.New("server sync requires id or slug")
		}
		return request(c, http.MethodPost, "/api/admin/servers/"+args[1]+"/sync", nil, out)
	case "sync-stdio":
		if len(args) < 2 {
			return errors.New("server sync-stdio requires id or slug")
		}
		f := valueAfter(args, "-f")
		srv, err := parseManifestFile(f)
		if err != nil {
			return err
		}
		snap, err := mcp.Client{Timeout: 20 * time.Second}.SyncStdio(context.Background(), srv.StdioCommand, srv.StdioArgs, os.Environ())
		if err != nil {
			return err
		}
		b, _ := json.Marshal(snap)
		return request(c, http.MethodPost, "/api/admin/servers/"+args[1]+"/snapshots", b, out)
	}
	return fmt.Errorf("unknown server command %s", args[0])
}
func request(c ConfigFile, method, path string, body []byte, out io.Writer) error {
	if c.APIURL == "" {
		c.APIURL = "http://localhost:4000"
	}
	req, err := http.NewRequest(method, strings.TrimRight(c.APIURL, "/")+path, bytes.NewReader(body))
	if err != nil {
		return err
	}
	if body != nil {
		req.Header.Set("content-type", "application/json")
	}
	if c.Token != "" {
		req.Header.Set("authorization", "Bearer "+c.Token)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	data, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 300 {
		return fmt.Errorf("%s", strings.TrimSpace(string(data)))
	}
	_, err = out.Write(data)
	return err
}
func login(args []string, out io.Writer) error {
	c := ConfigFile{APIURL: valueAfter(args, "--api-url"), Token: valueAfter(args, "--token")}
	if c.APIURL == "" || c.Token == "" {
		return errors.New("login requires --api-url and --token")
	}
	if err := save(c); err != nil {
		return err
	}
	_, err := fmt.Fprintln(out, "logged in")
	return err
}
func logout(out io.Writer) error {
	_ = os.Remove(configPath())
	_, err := fmt.Fprintln(out, "logged out")
	return err
}
func stripGlobal(args []string, c *ConfigFile, output *string) []string {
	out := []string{}
	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "--api-url":
			i++
			if i < len(args) {
				c.APIURL = args[i]
			}
		case "--token":
			i++
			if i < len(args) {
				c.Token = args[i]
			}
		case "--output":
			i++
			if i < len(args) {
				*output = args[i]
			}
		default:
			out = append(out, args[i])
		}
	}
	return out
}
func load() ConfigFile {
	var c ConfigFile
	b, err := os.ReadFile(configPath())
	if err == nil {
		_ = json.Unmarshal(b, &c)
	}
	return c
}
func save(c ConfigFile) error {
	p := configPath()
	if err := os.MkdirAll(filepath.Dir(p), 0700); err != nil {
		return err
	}
	b, _ := json.MarshalIndent(c, "", "  ")
	return os.WriteFile(p, b, 0600)
}
func configPath() string {
	if home, err := os.UserHomeDir(); err == nil {
		return filepath.Join(home, ".config", "mcphubctl", "config.json")
	}
	return ".mcphubctl.json"
}
func manifest(path string) ([]byte, error) {
	s, err := parseManifestFile(path)
	if err != nil {
		return nil, err
	}
	return json.Marshal(s)
}
func parseManifestFile(path string) (db.Server, error) {
	if path == "" {
		return db.Server{}, errors.New("manifest -f is required")
	}
	b, err := os.ReadFile(path)
	if err != nil {
		return db.Server{}, err
	}
	return parseManifest(string(b))
}
func parseManifest(v string) (db.Server, error) {
	lines := strings.Split(v, "\n")
	var s db.Server
	section := ""
	for _, line := range lines {
		raw := line
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if strings.HasSuffix(line, ":") {
			section = strings.TrimSuffix(line, ":")
			continue
		}
		if strings.HasPrefix(line, "-") {
			val := strings.TrimSpace(strings.TrimPrefix(line, "-"))
			if section == "args" || section == "stdio.args" {
				s.StdioArgs = append(s.StdioArgs, val)
			}
			if section == "envKeys" || section == "stdio.envKeys" {
				s.StdioEnvKeys = append(s.StdioEnvKeys, val)
			}
			if section == "tags" {
				s.Tags = append(s.Tags, val)
			}
			continue
		}
		kv := strings.SplitN(line, ":", 2)
		if len(kv) != 2 {
			_ = raw
			continue
		}
		k := strings.TrimSpace(kv[0])
		val := strings.Trim(strings.TrimSpace(kv[1]), "\"")
		if section == "stdio" {
			k = "stdio." + k
		}
		switch k {
		case "slug":
			s.Slug = val
		case "name":
			s.Name = val
		case "description":
			s.Description = val
		case "transport":
			s.Transport = db.Transport(val)
		case "hostingType":
			s.HostingType = val
		case "ownerTeam":
			s.OwnerTeam = val
		case "contact":
			s.Contact = val
		case "repositoryUrl":
			s.RepositoryURL = val
		case "runbookUrl":
			s.RunbookURL = val
		case "environment":
			s.Environment = val
		case "endpoint", "endpointUrl":
			s.EndpointURL = val
		case "stdio.command":
			s.StdioCommand = val
		}
	}
	return s, nil
}
func valueAfter(args []string, key string) string {
	for i, a := range args {
		if a == key && i+1 < len(args) {
			return args[i+1]
		}
	}
	return ""
}
func has(args []string, key string) bool {
	for _, a := range args {
		if a == key {
			return true
		}
	}
	return false
}
func env(k, f string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return f
}
func print(out io.Writer, output string, v interface{}) error {
	b, _ := json.MarshalIndent(v, "", "  ")
	_, err := fmt.Fprintln(out, string(b))
	return err
}
