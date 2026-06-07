package config

import (
	"os"
	"strconv"
)

type Config struct {
	Host          string
	Port          int
	LogLevel      string
	AuthMode      string
	OIDCIssuerURL string
	OIDCAudience  string
	PublicURL     string
	APIURL        string
	GatewayURL    string
	DatabaseURL   string
	RedisURL      string
}

func Load(defaultPort int) Config {
	return Config{
		Host:          getenv("HOST", "0.0.0.0"),
		Port:          getenvInt("PORT", defaultPort),
		LogLevel:      getenv("LOG_LEVEL", "info"),
		AuthMode:      getenv("MCP_AUTH_MODE", "mock"),
		OIDCIssuerURL: getenv("OIDC_ISSUER_URL", "mock-auth"),
		OIDCAudience:  getenv("OIDC_AUDIENCE", "mcp-hub"),
		PublicURL:     getenv("MCP_HUB_PUBLIC_URL", "http://localhost:3000"),
		APIURL:        getenv("MCP_API_URL", "http://localhost:4000"),
		GatewayURL:    getenv("MCP_GATEWAY_URL", "http://localhost:5000"),
		DatabaseURL:   os.Getenv("DATABASE_URL"),
		RedisURL:      os.Getenv("REDIS_URL"),
	}
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
