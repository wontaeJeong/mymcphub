package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Host                       string
	Port                       int
	LogLevel                   string
	AuthMode                   string
	OIDCIssuerURL              string
	OIDCAudience               string
	OIDCRequiredScope          string
	PublicURL                  string
	APIURL                     string
	GatewayURL                 string
	DatabaseURL                string
	RedisURL                   string
	GatewayRateLimit           int
	GatewayRateLimitWindow     int
	GatewaySessionIdleSec      int
	GatewayUpstreamTimeout     int
	GatewayCircuitThreshold    int
	GatewayCircuitOpenSec      int
	GatewayAllowDynamicClients bool
	TrustedAuthHeaders         bool
	RuntimeNamespace           string
	RuntimeControllerMode      string
	SecretLeaseSeconds         int
	RuntimeReconcileInterval   time.Duration
	WorkerJobToken             string
	WorkerIntervalSeconds      int
}

func Load(defaultPort int) Config {
	return Config{
		Host:                       getenv("HOST", "127.0.0.1"),
		Port:                       getenvInt("PORT", defaultPort),
		LogLevel:                   getenv("LOG_LEVEL", "info"),
		AuthMode:                   getenv("MCP_AUTH_MODE", "mock"),
		OIDCIssuerURL:              getenv("OIDC_ISSUER_URL", "mock-auth"),
		OIDCAudience:               getenv("OIDC_AUDIENCE", "mcp-hub"),
		OIDCRequiredScope:          getenv("OIDC_REQUIRED_SCOPE", "mcp:gateway"),
		PublicURL:                  getenv("MCP_HUB_PUBLIC_URL", "http://localhost:3000"),
		APIURL:                     getenv("MCP_API_URL", "http://localhost:4000"),
		GatewayURL:                 getenv("MCP_GATEWAY_URL", "http://localhost:5000"),
		DatabaseURL:                os.Getenv("DATABASE_URL"),
		RedisURL:                   os.Getenv("REDIS_URL"),
		GatewayRateLimit:           getenvInt("MCP_GATEWAY_RATE_LIMIT", 1000),
		GatewayRateLimitWindow:     getenvInt("MCP_GATEWAY_RATE_LIMIT_WINDOW_SECONDS", 60),
		GatewaySessionIdleSec:      getenvInt("MCP_GATEWAY_SESSION_IDLE_SECONDS", 300),
		GatewayUpstreamTimeout:     getenvInt("MCP_GATEWAY_UPSTREAM_TIMEOUT_SECONDS", 2),
		GatewayCircuitThreshold:    getenvInt("MCP_GATEWAY_CIRCUIT_THRESHOLD", 3),
		GatewayCircuitOpenSec:      getenvInt("MCP_GATEWAY_CIRCUIT_OPEN_SECONDS", 30),
		GatewayAllowDynamicClients: getenvBool("MCP_ALLOW_DYNAMIC_CLIENTS", false),
		TrustedAuthHeaders:         getenvBool("MCP_TRUSTED_AUTH_HEADERS", false),
		RuntimeNamespace:           getenv("MCP_RUNTIME_NAMESPACE", "mcp-runtime"),
		RuntimeControllerMode:      getenv("MCP_RUNTIME_CONTROLLER_MODE", "render"),
		SecretLeaseSeconds:         getenvInt("MCP_SECRET_LEASE_SECONDS", 1800),
		RuntimeReconcileInterval:   getenvDuration("MCP_RUNTIME_RECONCILE_INTERVAL", time.Minute),
		WorkerJobToken:             os.Getenv("MCP_WORKER_JOB_TOKEN"),
		WorkerIntervalSeconds:      getenvInt("MCP_WORKER_INTERVAL_SECONDS", 60),
	}
}

func (c Config) RateLimitWindow() int {
	if c.GatewayRateLimitWindow <= 0 {
		return 60
	}
	return c.GatewayRateLimitWindow
}

func (c Config) SessionIdleSeconds() int {
	if c.GatewaySessionIdleSec <= 0 {
		return 300
	}
	return c.GatewaySessionIdleSec
}

func (c Config) UpstreamTimeoutSeconds() int {
	if c.GatewayUpstreamTimeout <= 0 {
		return 2
	}
	return c.GatewayUpstreamTimeout
}

func (c Config) CircuitThreshold() int {
	if c.GatewayCircuitThreshold <= 0 {
		return 3
	}
	return c.GatewayCircuitThreshold
}

func (c Config) CircuitOpenSeconds() int {
	if c.GatewayCircuitOpenSec <= 0 {
		return 30
	}
	return c.GatewayCircuitOpenSec
}

func getenv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
func getenvInt(key string, fallback int) int {
	if value := os.Getenv(key); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil {
			return parsed
		}
	}
	return fallback
}

func getenvBool(key string, fallback bool) bool {
	if value := os.Getenv(key); value != "" {
		switch strings.ToLower(strings.TrimSpace(value)) {
		case "1", "true", "yes", "on":
			return true
		case "0", "false", "no", "off":
			return false
		}
	}
	return fallback
}

func getenvDuration(key string, fallback time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if parsed, err := time.ParseDuration(value); err == nil && parsed > 0 {
			return parsed
		}
	}
	return fallback
}
