package audit

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"

	"github.com/mcp-hub/mcp-hub/internal/db"
)

type Export struct {
	ExportID           string            `json:"exportId"`
	GeneratedAt        string            `json:"generatedAt"`
	From               string            `json:"from"`
	To                 string            `json:"to"`
	Redacted           bool              `json:"redacted"`
	Signed             bool              `json:"signed"`
	SignatureAlgorithm string            `json:"signatureAlgorithm,omitempty"`
	Signature          string            `json:"signature,omitempty"`
	Filters            map[string]string `json:"filters"`
	Count              int               `json:"count"`
	Items              []db.AuditEvent   `json:"items"`
}

func NewExport(items []db.AuditEvent, filters map[string]string, redacted bool) Export {
	outFilters := map[string]string{}
	for key, value := range filters {
		if value != "" {
			outFilters[key] = value
		}
	}
	return Export{ExportID: db.NewID(), GeneratedAt: db.Now(), From: outFilters["from"], To: outFilters["to"], Redacted: redacted, Filters: outFilters, Count: len(items), Items: items}
}

func SignExport(export Export, key string) (Export, error) {
	export.Signed = false
	export.SignatureAlgorithm = ""
	export.Signature = ""
	encoded, err := json.Marshal(export)
	if err != nil {
		return Export{}, err
	}
	mac := hmac.New(sha256.New, []byte(key))
	_, _ = mac.Write(encoded)
	export.Signed = true
	export.SignatureAlgorithm = "HMAC-SHA256"
	export.Signature = base64.StdEncoding.EncodeToString(mac.Sum(nil))
	return export, nil
}
