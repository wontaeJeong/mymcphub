package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Host                  string
	Port                  int
	AuthMode              string
	AdminToken            string
	ReadToken             string
	DatabaseURL           string
	APIURL                string
	WorkerInterval        time.Duration
	SyncTimeout           time.Duration
	AllowPrivateEndpoints bool
	AllowedEndpointSuffix []string
	EnableServerStdioExec bool
}

func Load(defaultPort int) Config {
	cfg := Config{
		Host:                  getenv("HOST", "127.0.0.1"),
		Port:                  getenvInt("PORT", defaultPort),
		AuthMode:              getenv("MCPHUB_AUTH_MODE", getenv("MCP_AUTH_MODE", "dev")),
		AdminToken:            os.Getenv("MCPHUB_ADMIN_TOKEN"),
		ReadToken:             os.Getenv("MCPHUB_READ_TOKEN"),
		DatabaseURL:           getenv("DATABASE_URL", "postgres://mcp:mcp@localhost:5432/mcp_hub?sslmode=disable"),
		APIURL:                getenv("MCPHUB_API_URL", getenv("MCP_API_URL", "http://localhost:4000")),
		WorkerInterval:        getenvDuration("MCPHUB_WORKER_INTERVAL", 60*time.Second),
		SyncTimeout:           getenvDuration("MCPHUB_SYNC_TIMEOUT", 20*time.Second),
		AllowPrivateEndpoints: getenvBool("MCPHUB_ALLOW_PRIVATE_ENDPOINTS", true),
		AllowedEndpointSuffix: split(os.Getenv("MCPHUB_ALLOWED_ENDPOINT_SUFFIXES")),
		EnableServerStdioExec: getenvBool("MCPHUB_ENABLE_SERVER_STDIO_EXEC", false),
	}
	if cfg.AdminToken == "" && cfg.AuthMode != "dev" {
		panic("MCPHUB_ADMIN_TOKEN is required unless MCPHUB_AUTH_MODE=dev")
	}
	if cfg.AdminToken == "" {
		cfg.AdminToken = "dev-admin-token"
	}
	if cfg.ReadToken == "" && cfg.AuthMode == "dev" {
		cfg.ReadToken = "dev-readonly-token"
	}
	return cfg
}

func (c Config) Addr() string { return fmt.Sprintf("%s:%d", c.Host, c.Port) }

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
func getenvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}
func getenvBool(key string, fallback bool) bool {
	if v := strings.ToLower(strings.TrimSpace(os.Getenv(key))); v != "" {
		return v == "1" || v == "true" || v == "yes" || v == "on"
	}
	return fallback
}
func getenvDuration(key string, fallback time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil && d > 0 {
			return d
		}
	}
	return fallback
}
func split(v string) []string {
	parts := strings.Split(v, ",")
	out := []string{}
	for _, p := range parts {
		if s := strings.TrimSpace(p); s != "" {
			out = append(out, s)
		}
	}
	return out
}
