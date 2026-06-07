package runtime

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sort"
	"strings"
	"time"
)

const (
	DefaultNamespace          = "mcp-runtime"
	DefaultLeaseDuration      = 30 * time.Minute
	PhaseRendered             = "rendered"
	PhaseDryRun               = "dry_run"
	DefaultServiceAccountName = "mcp-runtime-server"
)

type Manifest struct {
	Version                string          `json:"version,omitempty"`
	Slug                   string          `json:"slug"`
	DisplayName            string          `json:"displayName"`
	Description            string          `json:"description,omitempty"`
	OwnerTeam              string          `json:"ownerTeam,omitempty"`
	OwnerTeamID            string          `json:"ownerTeamId"`
	Environment            string          `json:"environment"`
	Transport              string          `json:"transport"`
	UpstreamURL            string          `json:"upstreamUrl,omitempty"`
	RiskLevel              string          `json:"riskLevel"`
	ImplementationLanguage string          `json:"implementationLanguage"`
	PolicyTags             []string        `json:"policyTags,omitempty"`
	Runtime                RuntimeSpec     `json:"runtime,omitempty"`
	Secrets                []SecretBinding `json:"secrets,omitempty"`
	Egress                 EgressPolicy    `json:"egress,omitempty"`
	Sandbox                SandboxProfile  `json:"sandbox,omitempty"`
	Tools                  []ToolManifest  `json:"tools"`
}

type RuntimeSpec struct {
	Image              string            `json:"image,omitempty"`
	ImagePullPolicy    string            `json:"imagePullPolicy,omitempty"`
	Command            []string          `json:"command,omitempty"`
	Args               []string          `json:"args,omitempty"`
	Port               int               `json:"port,omitempty"`
	Replicas           int               `json:"replicas,omitempty"`
	ServiceAccountName string            `json:"serviceAccountName,omitempty"`
	Path               string            `json:"path,omitempty"`
	Labels             map[string]string `json:"labels,omitempty"`
	Annotations        map[string]string `json:"annotations,omitempty"`
}

type SecretBinding struct {
	Ref                  string `json:"ref"`
	TargetEnv            string `json:"targetEnv"`
	SecretName           string `json:"secretName"`
	SecretKey            string `json:"secretKey"`
	LeaseDurationSeconds int    `json:"leaseDurationSeconds,omitempty"`
}

type EgressPolicy struct {
	DenyByDefault bool         `json:"denyByDefault"`
	Allow         []EgressRule `json:"allow,omitempty"`
}

type EgressRule struct {
	Host     string `json:"host,omitempty"`
	CIDR     string `json:"cidr,omitempty"`
	Port     int    `json:"port"`
	Protocol string `json:"protocol,omitempty"`
}

type SandboxProfile struct {
	Profile                  string          `json:"profile,omitempty"`
	RuntimeClassName         string          `json:"runtimeClassName,omitempty"`
	SeccompProfileType       string          `json:"seccompProfileType,omitempty"`
	RunAsNonRoot             bool            `json:"runAsNonRoot"`
	RunAsUser                int64           `json:"runAsUser,omitempty"`
	ReadOnlyRootFilesystem   bool            `json:"readOnlyRootFilesystem"`
	AllowPrivilegeEscalation bool            `json:"allowPrivilegeEscalation"`
	Resources                ResourceProfile `json:"resources,omitempty"`
}

type ResourceProfile struct {
	Requests map[string]string `json:"requests,omitempty"`
	Limits   map[string]string `json:"limits,omitempty"`
}

type ToolManifest struct {
	Name         string                 `json:"name"`
	Description  string                 `json:"description,omitempty"`
	Enabled      bool                   `json:"enabled,omitempty"`
	ReadOnly     bool                   `json:"readOnly"`
	RiskLevel    string                 `json:"riskLevel"`
	PolicyTags   []string               `json:"policyTags,omitempty"`
	InputSchema  map[string]interface{} `json:"inputSchema"`
	OutputSchema map[string]interface{} `json:"outputSchema,omitempty"`
}

type RenderedObject struct {
	Kind      string                 `json:"kind"`
	Name      string                 `json:"name"`
	Namespace string                 `json:"namespace"`
	Object    map[string]interface{} `json:"object"`
}

type SecretLease struct {
	ID                   string `json:"id"`
	ServerSlug           string `json:"serverSlug"`
	SecretRef            string `json:"secretRef"`
	TargetEnv            string `json:"targetEnv"`
	Status               string `json:"status"`
	IssuedAt             string `json:"issuedAt"`
	ExpiresAt            string `json:"expiresAt"`
	LeaseDurationSeconds int    `json:"leaseDurationSeconds"`
}

type Plan struct {
	ManifestHash string           `json:"manifestHash"`
	Namespace    string           `json:"namespace"`
	Phase        string           `json:"phase"`
	Resources    []RenderedObject `json:"resources"`
	SecretLeases []SecretLease    `json:"secretLeases"`
	Warnings     []string         `json:"warnings,omitempty"`
}

type Reconciler struct {
	Namespace string
	Clock     func() time.Time
	DryRun    bool
}

func NewReconciler(namespace string) Reconciler {
	if strings.TrimSpace(namespace) == "" {
		namespace = DefaultNamespace
	}
	return Reconciler{Namespace: namespace, Clock: time.Now}
}

func LoadManifest(path string) (Manifest, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return Manifest{}, err
	}
	return ManifestFromJSON(data)
}

func ManifestFromJSON(data []byte) (Manifest, error) {
	if err := validateRawManifestContract(data); err != nil {
		return Manifest{}, err
	}
	var manifest Manifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return Manifest{}, err
	}
	normalizeManifest(&manifest)
	return manifest, Validate(manifest)
}

func ManifestFromMap(value map[string]interface{}) (Manifest, error) {
	data, err := json.Marshal(value)
	if err != nil {
		return Manifest{}, err
	}
	return ManifestFromJSON(data)
}

func Validate(manifest Manifest) error {
	missing := []string{}
	for field, value := range map[string]string{"slug": manifest.Slug, "displayName": manifest.DisplayName, "ownerTeamId": manifest.OwnerTeamID, "environment": manifest.Environment, "transport": manifest.Transport, "riskLevel": manifest.RiskLevel, "implementationLanguage": manifest.ImplementationLanguage} {
		if strings.TrimSpace(value) == "" {
			missing = append(missing, field)
		}
	}
	if len(missing) > 0 {
		sort.Strings(missing)
		return fmt.Errorf("%w: missing manifest fields: %s", ErrInvalidManifest, strings.Join(missing, ", "))
	}
	if !validUUID(manifest.OwnerTeamID) {
		return fmt.Errorf("%w: ownerTeamId must be a UUID", ErrInvalidManifest)
	}
	if !validSlug(manifest.Slug) {
		return fmt.Errorf("%w: slug must match ^[a-z0-9-]+$", ErrInvalidManifest)
	}
	if !oneOf(manifest.Environment, "dev", "stg", "prod", "shared") {
		return fmt.Errorf("%w: invalid environment %s", ErrInvalidManifest, manifest.Environment)
	}
	if !oneOf(manifest.Transport, "streamable_http", "sse_legacy", "stdio_adapter", "external") {
		return fmt.Errorf("%w: invalid transport %s", ErrInvalidManifest, manifest.Transport)
	}
	if !validRisk(manifest.RiskLevel) {
		return fmt.Errorf("%w: invalid riskLevel %s", ErrInvalidManifest, manifest.RiskLevel)
	}
	if !oneOf(manifest.ImplementationLanguage, "go", "python", "typescript") {
		return fmt.Errorf("%w: invalid implementationLanguage %s", ErrInvalidManifest, manifest.ImplementationLanguage)
	}
	if manifest.Runtime.Port < 0 || manifest.Runtime.Port > 65535 {
		return fmt.Errorf("%w: runtime.port must be between 1 and 65535 when set", ErrInvalidManifest)
	}
	if manifest.Runtime.ImagePullPolicy != "" && !oneOf(manifest.Runtime.ImagePullPolicy, "Always", "IfNotPresent", "Never") {
		return fmt.Errorf("%w: invalid runtime.imagePullPolicy %s", ErrInvalidManifest, manifest.Runtime.ImagePullPolicy)
	}
	if manifest.Runtime.Replicas < 0 {
		return fmt.Errorf("%w: runtime.replicas must not be negative", ErrInvalidManifest)
	}
	if manifest.Sandbox.Profile != "" && !oneOf(manifest.Sandbox.Profile, "restricted", "gvisor", "kata") {
		return fmt.Errorf("%w: invalid sandbox.profile %s", ErrInvalidManifest, manifest.Sandbox.Profile)
	}
	if manifest.Sandbox.SeccompProfileType != "" && !oneOf(manifest.Sandbox.SeccompProfileType, "RuntimeDefault", "Localhost") {
		return fmt.Errorf("%w: invalid sandbox.seccompProfileType %s", ErrInvalidManifest, manifest.Sandbox.SeccompProfileType)
	}
	if manifest.Sandbox.RunAsUser < 0 {
		return fmt.Errorf("%w: sandbox.runAsUser must be positive when set", ErrInvalidManifest)
	}
	if len(manifest.Tools) == 0 {
		return fmt.Errorf("%w: at least one tool is required", ErrInvalidManifest)
	}
	for _, tool := range manifest.Tools {
		if strings.TrimSpace(tool.Name) == "" || strings.TrimSpace(tool.RiskLevel) == "" || tool.InputSchema == nil {
			return fmt.Errorf("%w: each tool requires name, riskLevel, and inputSchema", ErrInvalidManifest)
		}
		if !validRisk(tool.RiskLevel) {
			return fmt.Errorf("%w: invalid tool riskLevel %s", ErrInvalidManifest, tool.RiskLevel)
		}
		if tool.InputSchema["type"] != "object" || tool.InputSchema["additionalProperties"] != false {
			return fmt.Errorf("%w: tool %s inputSchema must be a closed object", ErrInvalidManifest, tool.Name)
		}
	}
	for _, secret := range manifest.Secrets {
		if strings.TrimSpace(secret.Ref) == "" || strings.TrimSpace(secret.TargetEnv) == "" || strings.TrimSpace(secret.SecretName) == "" || strings.TrimSpace(secret.SecretKey) == "" {
			return fmt.Errorf("%w: secret bindings require ref, targetEnv, secretName, and secretKey", ErrInvalidManifest)
		}
		if secret.LeaseDurationSeconds > 0 && secret.LeaseDurationSeconds < 60 {
			return fmt.Errorf("%w: secret leaseDurationSeconds must be at least 60 when set", ErrInvalidManifest)
		}
	}
	for _, rule := range manifest.Egress.Allow {
		if strings.TrimSpace(rule.Host) == "" && strings.TrimSpace(rule.CIDR) == "" {
			return fmt.Errorf("%w: egress rules require host or cidr", ErrInvalidManifest)
		}
		if rule.Port < 0 || rule.Port > 65535 {
			return fmt.Errorf("%w: egress port must be between 1 and 65535 when set", ErrInvalidManifest)
		}
		if rule.Protocol != "" && !oneOf(rule.Protocol, "TCP", "UDP") {
			return fmt.Errorf("%w: invalid egress protocol %s", ErrInvalidManifest, rule.Protocol)
		}
	}
	return nil
}

var ErrInvalidManifest = errors.New("invalid MCP server manifest")

func validateRawManifestContract(data []byte) error {
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	if err := validateRawObjectFields(raw, "manifest", allowedManifestFields()); err != nil {
		return err
	}
	if err := validateRawRuntime(raw["runtime"]); err != nil {
		return err
	}
	if err := validateRawSandbox(raw["sandbox"]); err != nil {
		return err
	}
	if err := validateRawSecrets(raw["secrets"]); err != nil {
		return err
	}
	if err := validateRawTools(raw["tools"]); err != nil {
		return err
	}
	return validateRawEgress(raw["egress"])
}

func validateRawRuntime(raw json.RawMessage) error {
	if raw == nil {
		return nil
	}
	runtimeSpec := map[string]json.RawMessage{}
	if err := json.Unmarshal(raw, &runtimeSpec); err != nil {
		return fmt.Errorf("%w: runtime must be an object", ErrInvalidManifest)
	}
	if err := validateRawObjectFields(runtimeSpec, "runtime", allowedRuntimeFields()); err != nil {
		return err
	}
	return validateRawIntRange(runtimeSpec["port"], "runtime.port", 1, 65535)
}

func validateRawSandbox(raw json.RawMessage) error {
	if raw == nil {
		return nil
	}
	sandbox := map[string]json.RawMessage{}
	if err := json.Unmarshal(raw, &sandbox); err != nil {
		return fmt.Errorf("%w: sandbox must be an object", ErrInvalidManifest)
	}
	if err := validateRawObjectFields(sandbox, "sandbox", allowedSandboxFields()); err != nil {
		return err
	}
	if sandbox["resources"] != nil {
		resources := map[string]json.RawMessage{}
		if err := json.Unmarshal(sandbox["resources"], &resources); err != nil {
			return fmt.Errorf("%w: sandbox.resources must be an object", ErrInvalidManifest)
		}
		if err := validateRawObjectFields(resources, "sandbox.resources", map[string]bool{"requests": true, "limits": true}); err != nil {
			return err
		}
	}
	return validateRawIntRange(sandbox["runAsUser"], "sandbox.runAsUser", 1, 0)
}

func validateRawSecrets(raw json.RawMessage) error {
	if raw == nil {
		return nil
	}
	var secrets []map[string]json.RawMessage
	if err := json.Unmarshal(raw, &secrets); err != nil {
		return fmt.Errorf("%w: secrets must be an array of objects", ErrInvalidManifest)
	}
	for index, secret := range secrets {
		for field := range secret {
			if !allowedSecretFields()[field] {
				if forbiddenSecretFields()[field] {
					return fmt.Errorf("%w: secrets[%d] must reference external secrets and must not include %s", ErrInvalidManifest, index, field)
				}
				return fmt.Errorf("%w: secrets[%d] includes unsupported field %s", ErrInvalidManifest, index, field)
			}
		}
		if err := validateRawIntRange(secret["leaseDurationSeconds"], fmt.Sprintf("secrets[%d].leaseDurationSeconds", index), 60, 0); err != nil {
			return err
		}
	}
	return nil
}

func validateRawTools(raw json.RawMessage) error {
	if raw == nil {
		return nil
	}
	var tools []map[string]json.RawMessage
	if err := json.Unmarshal(raw, &tools); err != nil {
		return fmt.Errorf("%w: tools must be an array of objects", ErrInvalidManifest)
	}
	for index, tool := range tools {
		if err := validateRawObjectFields(tool, fmt.Sprintf("tools[%d]", index), allowedToolFields()); err != nil {
			return err
		}
	}
	return nil
}

func validateRawEgress(raw json.RawMessage) error {
	if raw == nil {
		return nil
	}
	egress := map[string]json.RawMessage{}
	if err := json.Unmarshal(raw, &egress); err != nil {
		return fmt.Errorf("%w: egress must be an object", ErrInvalidManifest)
	}
	if err := validateRawObjectFields(egress, "egress", map[string]bool{"denyByDefault": true, "allow": true}); err != nil {
		return err
	}
	if egress["allow"] == nil {
		return nil
	}
	var rules []map[string]json.RawMessage
	if err := json.Unmarshal(egress["allow"], &rules); err != nil {
		return fmt.Errorf("%w: egress.allow must be an array of objects", ErrInvalidManifest)
	}
	for index, rule := range rules {
		if err := validateRawObjectFields(rule, fmt.Sprintf("egress.allow[%d]", index), map[string]bool{"host": true, "cidr": true, "port": true, "protocol": true}); err != nil {
			return err
		}
		if err := validateRawIntRange(rule["port"], fmt.Sprintf("egress.allow[%d].port", index), 1, 65535); err != nil {
			return err
		}
	}
	return nil
}

func validateRawObjectFields(raw map[string]json.RawMessage, label string, allowed map[string]bool) error {
	for field := range raw {
		if !allowed[field] {
			return fmt.Errorf("%w: %s includes unsupported field %s", ErrInvalidManifest, label, field)
		}
	}
	return nil
}

func validateRawIntRange(raw json.RawMessage, label string, minimum, maximum int) error {
	if raw == nil {
		return nil
	}
	var value int
	if err := json.Unmarshal(raw, &value); err != nil {
		return fmt.Errorf("%w: %s must be an integer", ErrInvalidManifest, label)
	}
	if value < minimum || (maximum > 0 && value > maximum) {
		if maximum > 0 {
			return fmt.Errorf("%w: %s must be between %d and %d", ErrInvalidManifest, label, minimum, maximum)
		}
		return fmt.Errorf("%w: %s must be at least %d", ErrInvalidManifest, label, minimum)
	}
	return nil
}

func forbiddenSecretFields() map[string]bool {
	return map[string]bool{"value": true, "token": true, "credential": true, "password": true, "clientSecret": true}
}

func allowedSecretFields() map[string]bool {
	return map[string]bool{"ref": true, "targetEnv": true, "secretName": true, "secretKey": true, "leaseDurationSeconds": true}
}

func allowedManifestFields() map[string]bool {
	return map[string]bool{"version": true, "slug": true, "displayName": true, "description": true, "ownerTeam": true, "ownerTeamId": true, "environment": true, "transport": true, "upstreamUrl": true, "enabled": true, "riskLevel": true, "implementationLanguage": true, "policyTags": true, "runtime": true, "secrets": true, "egress": true, "sandbox": true, "tools": true}
}

func allowedRuntimeFields() map[string]bool {
	return map[string]bool{"image": true, "imagePullPolicy": true, "command": true, "args": true, "port": true, "replicas": true, "serviceAccountName": true, "path": true, "labels": true, "annotations": true}
}

func allowedSandboxFields() map[string]bool {
	return map[string]bool{"profile": true, "runtimeClassName": true, "seccompProfileType": true, "runAsNonRoot": true, "runAsUser": true, "readOnlyRootFilesystem": true, "allowPrivilegeEscalation": true, "resources": true}
}

func allowedToolFields() map[string]bool {
	return map[string]bool{"name": true, "description": true, "enabled": true, "readOnly": true, "riskLevel": true, "policyTags": true, "inputSchema": true, "outputSchema": true}
}

func validSlug(value string) bool {
	if value == "" {
		return false
	}
	for _, r := range value {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			continue
		}
		return false
	}
	return true
}

func validUUID(value string) bool {
	if len(value) != 36 {
		return false
	}
	for index, r := range value {
		switch index {
		case 8, 13, 18, 23:
			if r != '-' {
				return false
			}
		default:
			if !((r >= 'a' && r <= 'f') || (r >= 'A' && r <= 'F') || (r >= '0' && r <= '9')) {
				return false
			}
		}
	}
	return true
}

func validRisk(value string) bool {
	return oneOf(value, "low", "medium", "high", "critical")
}

func oneOf(value string, allowed ...string) bool {
	for _, item := range allowed {
		if value == item {
			return true
		}
	}
	return false
}

func HashManifest(manifest Manifest) string {
	data, _ := json.Marshal(manifest)
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

func (r Reconciler) Reconcile(manifest Manifest) (Plan, error) {
	normalizeManifest(&manifest)
	if err := Validate(manifest); err != nil {
		return Plan{}, err
	}
	now := time.Now().UTC()
	if r.Clock != nil {
		now = r.Clock().UTC()
	}
	namespace := r.Namespace
	if strings.TrimSpace(namespace) == "" {
		namespace = DefaultNamespace
	}
	phase := PhaseRendered
	if r.DryRun {
		phase = PhaseDryRun
	}
	plan := Plan{ManifestHash: HashManifest(manifest), Namespace: namespace, Phase: phase}
	if manifest.Runtime.Image == "" {
		plan.Warnings = append(plan.Warnings, "runtime.image is empty; rendering metadata-only status")
	} else {
		plan.Resources = append(plan.Resources, RenderServiceAccount(manifest, namespace))
		plan.Resources = append(plan.Resources, RenderDeployment(manifest, namespace))
		if manifest.Runtime.Port > 0 {
			plan.Resources = append(plan.Resources, RenderService(manifest, namespace))
		}
	}
	plan.Resources = append(plan.Resources, RenderNetworkPolicy(manifest, namespace))
	for _, secret := range manifest.Secrets {
		seconds := secret.LeaseDurationSeconds
		if seconds <= 0 {
			seconds = int(DefaultLeaseDuration.Seconds())
		}
		plan.SecretLeases = append(plan.SecretLeases, SecretLease{ID: manifest.Slug + ":" + secret.Ref, ServerSlug: manifest.Slug, SecretRef: secret.Ref, TargetEnv: secret.TargetEnv, Status: "active", IssuedAt: now.Format(time.RFC3339Nano), ExpiresAt: now.Add(time.Duration(seconds) * time.Second).Format(time.RFC3339Nano), LeaseDurationSeconds: seconds})
	}
	return plan, nil
}

func RenderServiceAccount(manifest Manifest, namespace string) RenderedObject {
	name := serviceAccountName(manifest)
	return rendered("ServiceAccount", name, namespace, map[string]interface{}{
		"apiVersion": "v1",
		"kind":       "ServiceAccount",
		"metadata": map[string]interface{}{
			"name":      name,
			"namespace": namespace,
			"labels":    labels(manifest),
		},
		"automountServiceAccountToken": false,
	})
}

func RenderDeployment(manifest Manifest, namespace string) RenderedObject {
	name := resourceName(manifest)
	container := map[string]interface{}{
		"name":            manifest.Slug,
		"image":           manifest.Runtime.Image,
		"imagePullPolicy": manifest.Runtime.ImagePullPolicy,
		"securityContext": map[string]interface{}{
			"readOnlyRootFilesystem":   manifest.Sandbox.ReadOnlyRootFilesystem,
			"allowPrivilegeEscalation": manifest.Sandbox.AllowPrivilegeEscalation,
			"capabilities":             map[string]interface{}{"drop": []interface{}{"ALL"}},
		},
	}
	if len(manifest.Runtime.Command) > 0 {
		container["command"] = manifest.Runtime.Command
	}
	if len(manifest.Runtime.Args) > 0 {
		container["args"] = manifest.Runtime.Args
	}
	if manifest.Runtime.Port > 0 {
		container["ports"] = []interface{}{map[string]interface{}{"name": "mcp", "containerPort": manifest.Runtime.Port}}
	}
	if len(manifest.Secrets) > 0 {
		env := []interface{}{}
		for _, secret := range manifest.Secrets {
			env = append(env, map[string]interface{}{"name": secret.TargetEnv, "valueFrom": map[string]interface{}{"secretKeyRef": map[string]interface{}{"name": secret.SecretName, "key": secret.SecretKey}}})
		}
		container["env"] = env
	}
	if manifest.Sandbox.Resources.Requests != nil || manifest.Sandbox.Resources.Limits != nil {
		container["resources"] = map[string]interface{}{"requests": manifest.Sandbox.Resources.Requests, "limits": manifest.Sandbox.Resources.Limits}
	}
	podSpec := map[string]interface{}{
		"serviceAccountName": serviceAccountName(manifest),
		"securityContext": map[string]interface{}{
			"runAsNonRoot": manifest.Sandbox.RunAsNonRoot,
			"runAsUser":    manifest.Sandbox.RunAsUser,
			"seccompProfile": map[string]interface{}{
				"type": manifest.Sandbox.SeccompProfileType,
			},
		},
		"containers": []interface{}{container},
	}
	if manifest.Sandbox.RuntimeClassName != "" {
		podSpec["runtimeClassName"] = manifest.Sandbox.RuntimeClassName
	}
	return rendered("Deployment", name, namespace, map[string]interface{}{
		"apiVersion": "apps/v1",
		"kind":       "Deployment",
		"metadata": map[string]interface{}{
			"name":        name,
			"namespace":   namespace,
			"labels":      labels(manifest),
			"annotations": annotations(manifest),
		},
		"spec": map[string]interface{}{
			"replicas": manifest.Runtime.Replicas,
			"selector": map[string]interface{}{"matchLabels": selectorLabels(manifest)},
			"template": map[string]interface{}{
				"metadata": map[string]interface{}{"labels": labels(manifest), "annotations": annotations(manifest)},
				"spec":     podSpec,
			},
		},
	})
}

func RenderService(manifest Manifest, namespace string) RenderedObject {
	name := resourceName(manifest)
	return rendered("Service", name, namespace, map[string]interface{}{
		"apiVersion": "v1",
		"kind":       "Service",
		"metadata":   map[string]interface{}{"name": name, "namespace": namespace, "labels": labels(manifest)},
		"spec": map[string]interface{}{
			"type":     "ClusterIP",
			"selector": selectorLabels(manifest),
			"ports":    []interface{}{map[string]interface{}{"name": "mcp", "port": manifest.Runtime.Port, "targetPort": "mcp"}},
		},
	})
}

func RenderNetworkPolicy(manifest Manifest, namespace string) RenderedObject {
	egress := []interface{}{
		map[string]interface{}{"to": []interface{}{map[string]interface{}{"namespaceSelector": map[string]interface{}{}}}, "ports": []interface{}{map[string]interface{}{"protocol": "UDP", "port": 53}, map[string]interface{}{"protocol": "TCP", "port": 53}}},
	}
	hosts := []string{}
	for _, rule := range manifest.Egress.Allow {
		protocol := firstNonEmpty(rule.Protocol, "TCP")
		if rule.CIDR != "" {
			entry := map[string]interface{}{"to": []interface{}{map[string]interface{}{"ipBlock": map[string]interface{}{"cidr": rule.CIDR}}}}
			if rule.Port > 0 {
				entry["ports"] = []interface{}{map[string]interface{}{"protocol": protocol, "port": rule.Port}}
			}
			egress = append(egress, entry)
		}
		if rule.Host != "" {
			hosts = append(hosts, rule.Host)
		}
	}
	object := map[string]interface{}{
		"apiVersion": "networking.k8s.io/v1",
		"kind":       "NetworkPolicy",
		"metadata": map[string]interface{}{
			"name":      resourceName(manifest) + "-egress",
			"namespace": namespace,
			"labels":    labels(manifest),
			"annotations": map[string]interface{}{
				"mcp-hub.io/deny-by-default": fmt.Sprint(manifest.Egress.DenyByDefault),
			},
		},
		"spec": map[string]interface{}{
			"podSelector": map[string]interface{}{"matchLabels": selectorLabels(manifest)},
			"policyTypes": []interface{}{"Egress"},
			"egress":      egress,
		},
	}
	if len(hosts) > 0 {
		sort.Strings(hosts)
		object["metadata"].(map[string]interface{})["annotations"].(map[string]interface{})["mcp-hub.io/egress-host-allowlist"] = strings.Join(hosts, ",")
	}
	return rendered("NetworkPolicy", resourceName(manifest)+"-egress", namespace, object)
}

func normalizeManifest(manifest *Manifest) {
	if manifest.Version == "" {
		manifest.Version = "v1"
	}
	if manifest.Runtime.ImagePullPolicy == "" {
		manifest.Runtime.ImagePullPolicy = "IfNotPresent"
	}
	if manifest.Runtime.Replicas == 0 {
		manifest.Runtime.Replicas = 1
	}
	if manifest.Runtime.Path == "" {
		manifest.Runtime.Path = "/mcp"
	}
	if manifest.Sandbox.Profile == "" {
		manifest.Sandbox.Profile = "restricted"
	}
	if manifest.Sandbox.SeccompProfileType == "" {
		manifest.Sandbox.SeccompProfileType = "RuntimeDefault"
	}
	if manifest.Sandbox.RunAsUser == 0 {
		manifest.Sandbox.RunAsUser = 10001
	}
	manifest.Sandbox.RunAsNonRoot = true
	manifest.Sandbox.ReadOnlyRootFilesystem = true
	manifest.Sandbox.AllowPrivilegeEscalation = false
	manifest.Egress.DenyByDefault = true
	for i := range manifest.Secrets {
		if manifest.Secrets[i].LeaseDurationSeconds <= 0 {
			manifest.Secrets[i].LeaseDurationSeconds = int(DefaultLeaseDuration.Seconds())
		}
	}
}

func rendered(kind, name, namespace string, object map[string]interface{}) RenderedObject {
	return RenderedObject{Kind: kind, Name: name, Namespace: namespace, Object: object}
}

func resourceName(manifest Manifest) string { return "mcp-" + manifest.Slug }

func serviceAccountName(manifest Manifest) string {
	if manifest.Runtime.ServiceAccountName != "" {
		return manifest.Runtime.ServiceAccountName
	}
	return resourceName(manifest)
}

func selectorLabels(manifest Manifest) map[string]string {
	return map[string]string{"app.kubernetes.io/name": manifest.Slug, "app.kubernetes.io/part-of": "mcp-hub-runtime"}
}

func labels(manifest Manifest) map[string]string {
	out := selectorLabels(manifest)
	out["app.kubernetes.io/managed-by"] = "mcphub-runtime-controller"
	out["mcp-hub.io/server-slug"] = manifest.Slug
	for key, value := range manifest.Runtime.Labels {
		out[key] = value
	}
	return out
}

func annotations(manifest Manifest) map[string]string {
	out := map[string]string{
		"mcp-hub.io/manifest-version": manifest.Version,
		"mcp-hub.io/risk-level":       manifest.RiskLevel,
		"mcp-hub.io/transport":        manifest.Transport,
		"mcp-hub.io/sandbox-profile":  manifest.Sandbox.Profile,
	}
	if len(manifest.PolicyTags) > 0 {
		out["mcp-hub.io/policy-tags"] = strings.Join(manifest.PolicyTags, ",")
	}
	for key, value := range manifest.Runtime.Annotations {
		out[key] = value
	}
	return out
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
