package auth

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"strings"

	"github.com/mcp-hub/mcp-hub/internal/config"
)

type Principal struct {
	Actor string `json:"actor"`
	Admin bool   `json:"admin"`
}

func TraceID(r *http.Request) string {
	if v := strings.TrimSpace(r.Header.Get("x-trace-id")); v != "" {
		return v
	}
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "trace-local"
	}
	return hex.EncodeToString(b)
}

func Authenticate(r *http.Request, cfg config.Config, adminRequired bool) (Principal, bool) {
	if cfg.AuthMode == "dev" && strings.TrimSpace(r.Header.Get("authorization")) == "" && !adminRequired {
		return Principal{Actor: "dev-reader", Admin: false}, true
	}
	token := bearer(r)
	if token == cfg.AdminToken && token != "" {
		return Principal{Actor: "admin", Admin: true}, true
	}
	if !adminRequired && cfg.ReadToken != "" && token == cfg.ReadToken {
		return Principal{Actor: "reader", Admin: false}, true
	}
	if cfg.AuthMode == "dev" && adminRequired && token == "dev-admin-token" {
		return Principal{Actor: "admin", Admin: true}, true
	}
	return Principal{}, false
}

func bearer(r *http.Request) string {
	v := strings.TrimSpace(r.Header.Get("authorization"))
	if !strings.HasPrefix(strings.ToLower(v), "bearer ") {
		return ""
	}
	return strings.TrimSpace(v[7:])
}
