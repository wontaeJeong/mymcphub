package runtime

import (
	"testing"
	"time"
)

func TestReconcilerRendersRuntimeResourcesAndLeases(t *testing.T) {
	manifest := Manifest{
		Slug:                   "docs-readonly",
		DisplayName:            "Docs Readonly",
		OwnerTeamID:            "00000000-0000-4000-8000-000000000010",
		Environment:            "dev",
		Transport:              "streamable_http",
		RiskLevel:              "low",
		ImplementationLanguage: "go",
		Runtime:                RuntimeSpec{Image: "registry.example.com/docs:1", Port: 5113},
		Secrets:                []SecretBinding{{Ref: "docs-index", TargetEnv: "DOCS_INDEX", SecretName: "docs-index", SecretKey: "url", LeaseDurationSeconds: 600}},
		Egress:                 EgressPolicy{Allow: []EgressRule{{CIDR: "10.0.0.0/24", Port: 443, Protocol: "TCP"}, {Host: "docs.example.com", Port: 443, Protocol: "TCP"}}},
		Tools:                  []ToolManifest{{Name: "search_docs", RiskLevel: "low", ReadOnly: true, InputSchema: map[string]interface{}{"type": "object", "properties": map[string]interface{}{}, "additionalProperties": false}}},
	}
	reconciler := NewReconciler("runtime-ns")
	reconciler.Clock = func() time.Time { return time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC) }
	plan, err := reconciler.Reconcile(manifest)
	if err != nil {
		t.Fatal(err)
	}
	if plan.Phase != PhaseRendered || plan.Namespace != "runtime-ns" || len(plan.Resources) != 4 {
		t.Fatalf("unexpected plan: %#v", plan)
	}
	if len(plan.SecretLeases) != 1 || plan.SecretLeases[0].ExpiresAt == "" {
		t.Fatalf("expected one active lease, got %#v", plan.SecretLeases)
	}
	last := plan.Resources[len(plan.Resources)-1]
	if last.Kind != "NetworkPolicy" || last.Object["metadata"].(map[string]interface{})["annotations"].(map[string]interface{})["mcp-hub.io/egress-host-allowlist"] != "docs.example.com" {
		t.Fatalf("expected host allowlist annotation, got %#v", last)
	}
}

func TestValidateRejectsOpenToolSchema(t *testing.T) {
	manifest := Manifest{Slug: "bad", DisplayName: "Bad", OwnerTeamID: "00000000-0000-4000-8000-000000000010", Environment: "dev", Transport: "streamable_http", RiskLevel: "low", ImplementationLanguage: "go", Tools: []ToolManifest{{Name: "tool", RiskLevel: "low", InputSchema: map[string]interface{}{"type": "object"}}}}
	if err := Validate(manifest); err == nil {
		t.Fatalf("expected validation error")
	}
}

func TestManifestRejectsRawSecretFields(t *testing.T) {
	data := []byte(`{
		"slug":"bad-secret",
		"displayName":"Bad Secret",
		"ownerTeamId":"00000000-0000-4000-8000-000000000010",
		"environment":"dev",
		"transport":"streamable_http",
		"riskLevel":"low",
		"implementationLanguage":"go",
		"secrets":[{"ref":"provider","targetEnv":"PROVIDER_TOKEN","secretName":"provider","secretKey":"token","token":"raw-secret"}],
		"tools":[{"name":"probe","riskLevel":"low","readOnly":true,"inputSchema":{"type":"object","properties":{},"additionalProperties":false}}]
	}`)
	if _, err := ManifestFromJSON(data); err == nil {
		t.Fatalf("expected raw secret field rejection")
	}
}

func TestValidateRejectsSchemaContractMismatches(t *testing.T) {
	valid := Manifest{
		Slug:                   "contract-valid",
		DisplayName:            "Contract Valid",
		OwnerTeamID:            "00000000-0000-4000-8000-000000000010",
		Environment:            "dev",
		Transport:              "streamable_http",
		RiskLevel:              "low",
		ImplementationLanguage: "go",
		Runtime:                RuntimeSpec{Port: 5100, ImagePullPolicy: "IfNotPresent"},
		Egress:                 EgressPolicy{Allow: []EgressRule{{CIDR: "10.0.0.0/24", Port: 443, Protocol: "TCP"}}},
		Tools:                  []ToolManifest{{Name: "probe", RiskLevel: "low", ReadOnly: true, InputSchema: map[string]interface{}{"type": "object", "properties": map[string]interface{}{}, "additionalProperties": false}}},
	}
	cases := map[string]func(*Manifest){
		"invalid slug":       func(m *Manifest) { m.Slug = "Bad_Slug" },
		"invalid port":       func(m *Manifest) { m.Runtime.Port = 70000 },
		"invalid protocol":   func(m *Manifest) { m.Egress.Allow[0].Protocol = "SCTP" },
		"negative runAsUser": func(m *Manifest) { m.Sandbox.RunAsUser = -1 },
		"short lease": func(m *Manifest) {
			m.Secrets = []SecretBinding{{Ref: "token", TargetEnv: "TOKEN", SecretName: "provider", SecretKey: "token", LeaseDurationSeconds: 1}}
		},
		"invalid owner team":  func(m *Manifest) { m.OwnerTeamID = "team-1" },
		"missing risk":        func(m *Manifest) { m.RiskLevel = "" },
		"missing tool risk":   func(m *Manifest) { m.Tools[0].RiskLevel = "" },
		"invalid environment": func(m *Manifest) { m.Environment = "qa" },
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			manifest := valid
			manifest.Egress.Allow = append([]EgressRule{}, valid.Egress.Allow...)
			manifest.Tools = append([]ToolManifest{}, valid.Tools...)
			mutate(&manifest)
			if err := Validate(manifest); err == nil {
				t.Fatalf("expected validation error")
			}
		})
	}
}

func TestManifestFromMapRejectsRawSchemaContractMismatches(t *testing.T) {
	valid := map[string]interface{}{
		"slug":                   "contract-valid",
		"displayName":            "Contract Valid",
		"ownerTeamId":            "00000000-0000-4000-8000-000000000010",
		"environment":            "dev",
		"transport":              "streamable_http",
		"riskLevel":              "low",
		"implementationLanguage": "go",
		"runtime":                map[string]interface{}{"port": 5100, "imagePullPolicy": "IfNotPresent"},
		"sandbox":                map[string]interface{}{"runAsUser": 10001},
		"egress":                 map[string]interface{}{"allow": []interface{}{map[string]interface{}{"cidr": "10.0.0.0/24", "port": 443, "protocol": "TCP"}}},
		"secrets":                []interface{}{map[string]interface{}{"ref": "provider", "targetEnv": "TOKEN", "secretName": "provider", "secretKey": "token", "leaseDurationSeconds": 600}},
		"tools":                  []interface{}{map[string]interface{}{"name": "probe", "riskLevel": "low", "readOnly": true, "inputSchema": map[string]interface{}{"type": "object", "properties": map[string]interface{}{}, "additionalProperties": false}}},
	}
	cases := map[string]func(map[string]interface{}){
		"explicit runtime port zero": func(m map[string]interface{}) { m["runtime"].(map[string]interface{})["port"] = 0 },
		"explicit egress port zero": func(m map[string]interface{}) {
			m["egress"].(map[string]interface{})["allow"].([]interface{})[0].(map[string]interface{})["port"] = 0
		},
		"short raw lease": func(m map[string]interface{}) {
			m["secrets"].([]interface{})[0].(map[string]interface{})["leaseDurationSeconds"] = 1
		},
		"unexpected secret field": func(m map[string]interface{}) {
			m["secrets"].([]interface{})[0].(map[string]interface{})["apiKey"] = "raw-secret"
		},
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			manifest := cloneManifestMap(valid)
			mutate(manifest)
			if _, err := ManifestFromMap(manifest); err == nil {
				t.Fatalf("expected validation error")
			}
		})
	}
}

func cloneManifestMap(input map[string]interface{}) map[string]interface{} {
	out := map[string]interface{}{}
	for key, value := range input {
		switch typed := value.(type) {
		case map[string]interface{}:
			out[key] = cloneManifestMap(typed)
		case []interface{}:
			cloned := make([]interface{}, len(typed))
			for index, item := range typed {
				if itemMap, ok := item.(map[string]interface{}); ok {
					cloned[index] = cloneManifestMap(itemMap)
				} else {
					cloned[index] = item
				}
			}
			out[key] = cloned
		default:
			out[key] = value
		}
	}
	return out
}
