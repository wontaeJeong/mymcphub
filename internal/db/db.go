package db

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"sort"
	"strings"
	"sync"
	"time"
)

type Transport string

const (
	TransportStreamableHTTP Transport = "streamable_http"
	TransportStdio          Transport = "stdio"
)

type Server struct {
	ID             string     `json:"id"`
	Slug           string     `json:"slug"`
	Name           string     `json:"name"`
	Description    string     `json:"description"`
	Transport      Transport  `json:"transport"`
	HostingType    string     `json:"hostingType"`
	OwnerTeam      string     `json:"ownerTeam"`
	Contact        string     `json:"contact"`
	RepositoryURL  string     `json:"repositoryUrl"`
	RunbookURL     string     `json:"runbookUrl"`
	Environment    string     `json:"environment"`
	Status         string     `json:"status"`
	LivenessStatus string     `json:"livenessStatus"`
	EndpointURL    string     `json:"endpointUrl,omitempty"`
	StdioCommand   string     `json:"stdioCommand,omitempty"`
	StdioArgs      []string   `json:"stdioArgs,omitempty"`
	StdioEnvKeys   []string   `json:"stdioEnvKeys,omitempty"`
	Tags           []string   `json:"tags"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
	LastSyncAt     *time.Time `json:"lastSyncAt,omitempty"`
	LastSyncStatus string     `json:"lastSyncStatus"`
	LastSyncError  string     `json:"lastSyncError,omitempty"`
	ToolCount      int        `json:"toolCount"`
	ResourceCount  int        `json:"resourceCount"`
	PromptCount    int        `json:"promptCount"`
	SnapshotHash   string     `json:"snapshotHash,omitempty"`
}

type ServerPatch struct{ Server }

type CapabilitySnapshot struct {
	ID              string                   `json:"id"`
	ServerID        string                   `json:"serverId"`
	Source          string                   `json:"source"`
	ProtocolVersion string                   `json:"protocolVersion"`
	ServerInfo      map[string]interface{}   `json:"serverInfo"`
	Capabilities    map[string]interface{}   `json:"capabilities"`
	Tools           []map[string]interface{} `json:"tools"`
	Resources       []map[string]interface{} `json:"resources"`
	Prompts         []map[string]interface{} `json:"prompts"`
	RawInitialize   map[string]interface{}   `json:"rawInitialize"`
	SnapshotHash    string                   `json:"snapshotHash"`
	CapturedAt      time.Time                `json:"capturedAt"`
	CreatedBy       string                   `json:"createdBy"`
	Warnings        []string                 `json:"warnings,omitempty"`
}

type HealthCheck struct {
	ID           string    `json:"id"`
	ServerID     string    `json:"serverId"`
	Status       string    `json:"status"`
	LatencyMS    int64     `json:"latencyMs"`
	CheckedAt    time.Time `json:"checkedAt"`
	ErrorMessage string    `json:"errorMessage,omitempty"`
}
type AuditEvent struct {
	ID        string                 `json:"id"`
	Timestamp time.Time              `json:"timestamp"`
	Actor     string                 `json:"actor"`
	Action    string                 `json:"action"`
	ServerID  string                 `json:"serverId,omitempty"`
	Metadata  map[string]interface{} `json:"metadata"`
}
type Summary struct {
	Total          int `json:"total"`
	StreamableHTTP int `json:"streamableHttp"`
	Stdio          int `json:"stdio"`
	Healthy        int `json:"healthy"`
	SyncFailed     int `json:"syncFailed"`
	StaleSnapshots int `json:"staleSnapshots"`
}
type ListResponse[T any] struct {
	Items []T `json:"items"`
}

type Repository interface {
	Ready(context.Context) error
	Summary(context.Context) (Summary, error)
	ListServers(context.Context, map[string]string) ([]Server, error)
	GetServer(context.Context, string) (Server, error)
	CreateServer(context.Context, Server, string) (Server, error)
	PatchServer(context.Context, string, ServerPatch, string) (Server, error)
	DeleteServer(context.Context, string, string) error
	SaveSnapshot(context.Context, string, CapabilitySnapshot, string) (CapabilitySnapshot, error)
	LatestSnapshot(context.Context, string) (CapabilitySnapshot, error)
	AddHealth(context.Context, HealthCheck) error
	ListHealth(context.Context, string) ([]HealthCheck, error)
	ListAudit(context.Context, string) ([]AuditEvent, error)
	MarkSyncFailed(context.Context, string, string, string) error
}

var ErrNotFound = errors.New("not found")

type MemoryRepository struct {
	mu        sync.Mutex
	servers   map[string]Server
	snapshots map[string][]CapabilitySnapshot
	health    map[string][]HealthCheck
	audit     []AuditEvent
}

func NewMemoryRepository() *MemoryRepository {
	r := &MemoryRepository{servers: map[string]Server{}, snapshots: map[string][]CapabilitySnapshot{}, health: map[string][]HealthCheck{}}
	seed := Server{Slug: "filesystem-local", Name: "Filesystem Local MCP", Description: "로컬 stdio MCP 예시", Transport: TransportStdio, HostingType: "local_stdio", OwnerTeam: "Platform Team", Contact: "platform@example.com", Environment: "shared", Status: "active", LivenessStatus: "unknown", StdioCommand: "dev/mock-mcp/stdio", Tags: []string{"local", "sample"}}
	_, _ = r.CreateServer(context.Background(), seed, "seed")
	return r
}
func (r *MemoryRepository) Ready(context.Context) error { return nil }
func (r *MemoryRepository) Summary(ctx context.Context) (Summary, error) {
	servers, _ := r.ListServers(ctx, nil)
	cutoff := time.Now().Add(-7 * 24 * time.Hour)
	var s Summary
	for _, v := range servers {
		s.Total++
		if v.Transport == TransportStreamableHTTP {
			s.StreamableHTTP++
		}
		if v.Transport == TransportStdio {
			s.Stdio++
		}
		if v.LivenessStatus == "healthy" {
			s.Healthy++
		}
		if v.LastSyncStatus == "failed" {
			s.SyncFailed++
		}
		if v.LastSyncAt == nil || v.LastSyncAt.Before(cutoff) {
			s.StaleSnapshots++
		}
	}
	return s, nil
}
func (r *MemoryRepository) ListServers(_ context.Context, f map[string]string) ([]Server, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := []Server{}
	for _, s := range r.servers {
		if matchServer(s, f) {
			out = append(out, s)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out, nil
}
func matchServer(s Server, f map[string]string) bool {
	if f == nil {
		return true
	}
	for k, v := range f {
		v = strings.ToLower(strings.TrimSpace(v))
		if v == "" {
			continue
		}
		switch k {
		case "transport":
			if strings.ToLower(string(s.Transport)) != v {
				return false
			}
		case "status":
			if strings.ToLower(s.Status) != v {
				return false
			}
		case "environment":
			if strings.ToLower(s.Environment) != v {
				return false
			}
		case "ownerTeam":
			if !strings.Contains(strings.ToLower(s.OwnerTeam), v) {
				return false
			}
		case "q":
			hay := strings.ToLower(s.Name + " " + s.Slug + " " + s.Description + " " + s.OwnerTeam)
			if !strings.Contains(hay, v) {
				return false
			}
		case "tag":
			ok := false
			for _, t := range s.Tags {
				if strings.ToLower(t) == v {
					ok = true
				}
			}
			if !ok {
				return false
			}
		case "livenessStatus":
			if strings.ToLower(s.LivenessStatus) != v {
				return false
			}
		}
	}
	return true
}
func (r *MemoryRepository) GetServer(_ context.Context, id string) (Server, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.getLocked(id)
}
func (r *MemoryRepository) getLocked(id string) (Server, error) {
	if s, ok := r.servers[id]; ok {
		return s, nil
	}
	for _, s := range r.servers {
		if s.Slug == id {
			return s, nil
		}
	}
	return Server{}, ErrNotFound
}
func (r *MemoryRepository) CreateServer(_ context.Context, s Server, actor string) (Server, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	now := time.Now().UTC()
	if s.ID == "" {
		s.ID = NewID()
	}
	if s.Slug == "" {
		s.Slug = slugify(s.Name)
	}
	if s.Status == "" {
		s.Status = "active"
	}
	if s.LivenessStatus == "" {
		s.LivenessStatus = "unknown"
	}
	if s.LastSyncStatus == "" {
		s.LastSyncStatus = "never"
	}
	s.CreatedAt = now
	s.UpdatedAt = now
	r.servers[s.ID] = s
	r.audit = append([]AuditEvent{{ID: NewID(), Timestamp: now, Actor: actor, Action: "server.created", ServerID: s.ID, Metadata: map[string]interface{}{"slug": s.Slug}}}, r.audit...)
	return s, nil
}
func (r *MemoryRepository) PatchServer(_ context.Context, id string, p ServerPatch, actor string) (Server, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	s, err := r.getLocked(id)
	if err != nil {
		return Server{}, err
	}
	apply(&s, p.Server)
	s.UpdatedAt = time.Now().UTC()
	r.servers[s.ID] = s
	r.audit = append([]AuditEvent{{ID: NewID(), Timestamp: s.UpdatedAt, Actor: actor, Action: "server.updated", ServerID: s.ID, Metadata: map[string]interface{}{"slug": s.Slug}}}, r.audit...)
	return s, nil
}
func apply(s *Server, p Server) {
	if p.Name != "" {
		s.Name = p.Name
	}
	if p.Description != "" {
		s.Description = p.Description
	}
	if p.Transport != "" {
		s.Transport = p.Transport
	}
	if p.HostingType != "" {
		s.HostingType = p.HostingType
	}
	if p.OwnerTeam != "" {
		s.OwnerTeam = p.OwnerTeam
	}
	if p.Contact != "" {
		s.Contact = p.Contact
	}
	if p.RepositoryURL != "" {
		s.RepositoryURL = p.RepositoryURL
	}
	if p.RunbookURL != "" {
		s.RunbookURL = p.RunbookURL
	}
	if p.Environment != "" {
		s.Environment = p.Environment
	}
	if p.Status != "" {
		s.Status = p.Status
	}
	if p.EndpointURL != "" {
		s.EndpointURL = p.EndpointURL
	}
	if p.StdioCommand != "" {
		s.StdioCommand = p.StdioCommand
	}
	if p.StdioArgs != nil {
		s.StdioArgs = p.StdioArgs
	}
	if p.StdioEnvKeys != nil {
		s.StdioEnvKeys = p.StdioEnvKeys
	}
	if p.Tags != nil {
		s.Tags = p.Tags
	}
}
func (r *MemoryRepository) DeleteServer(_ context.Context, id, actor string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	s, err := r.getLocked(id)
	if err != nil {
		return err
	}
	delete(r.servers, s.ID)
	r.audit = append([]AuditEvent{{ID: NewID(), Timestamp: time.Now().UTC(), Actor: actor, Action: "server.deleted", ServerID: s.ID, Metadata: map[string]interface{}{"slug": s.Slug}}}, r.audit...)
	return nil
}
func (r *MemoryRepository) SaveSnapshot(_ context.Context, id string, snap CapabilitySnapshot, actor string) (CapabilitySnapshot, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	s, err := r.getLocked(id)
	if err != nil {
		return CapabilitySnapshot{}, err
	}
	now := time.Now().UTC()
	if snap.ID == "" {
		snap.ID = NewID()
	}
	snap.ServerID = s.ID
	if snap.CapturedAt.IsZero() {
		snap.CapturedAt = now
	}
	if snap.CreatedBy == "" {
		snap.CreatedBy = actor
	}
	if snap.SnapshotHash == "" {
		snap.SnapshotHash = SnapshotHash(snap)
	}
	r.snapshots[s.ID] = append([]CapabilitySnapshot{snap}, r.snapshots[s.ID]...)
	t := snap.CapturedAt
	s.LastSyncAt = &t
	s.LastSyncStatus = "success"
	s.LastSyncError = ""
	s.ToolCount = len(snap.Tools)
	s.ResourceCount = len(snap.Resources)
	s.PromptCount = len(snap.Prompts)
	s.SnapshotHash = snap.SnapshotHash
	s.UpdatedAt = now
	r.servers[s.ID] = s
	r.audit = append([]AuditEvent{{ID: NewID(), Timestamp: now, Actor: actor, Action: "snapshot.saved", ServerID: s.ID, Metadata: map[string]interface{}{"hash": snap.SnapshotHash, "source": snap.Source}}}, r.audit...)
	return snap, nil
}
func (r *MemoryRepository) LatestSnapshot(_ context.Context, id string) (CapabilitySnapshot, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	s, err := r.getLocked(id)
	if err != nil {
		return CapabilitySnapshot{}, err
	}
	snaps := r.snapshots[s.ID]
	if len(snaps) == 0 {
		return CapabilitySnapshot{}, ErrNotFound
	}
	return snaps[0], nil
}
func (r *MemoryRepository) AddHealth(_ context.Context, h HealthCheck) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if h.ID == "" {
		h.ID = NewID()
	}
	if h.CheckedAt.IsZero() {
		h.CheckedAt = time.Now().UTC()
	}
	r.health[h.ServerID] = append([]HealthCheck{h}, r.health[h.ServerID]...)
	if s, ok := r.servers[h.ServerID]; ok {
		s.LivenessStatus = h.Status
		s.UpdatedAt = time.Now().UTC()
		r.servers[s.ID] = s
	}
	return nil
}
func (r *MemoryRepository) ListHealth(_ context.Context, id string) ([]HealthCheck, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if id != "" {
		s, err := r.getLocked(id)
		if err != nil {
			return nil, err
		}
		return append([]HealthCheck{}, r.health[s.ID]...), nil
	}
	out := []HealthCheck{}
	for _, v := range r.health {
		out = append(out, v...)
	}
	return out, nil
}
func (r *MemoryRepository) ListAudit(_ context.Context, serverID string) ([]AuditEvent, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := []AuditEvent{}
	for _, e := range r.audit {
		if serverID == "" || e.ServerID == serverID {
			out = append(out, e)
		}
	}
	return out, nil
}
func (r *MemoryRepository) MarkSyncFailed(_ context.Context, id, message, actor string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	s, err := r.getLocked(id)
	if err != nil {
		return err
	}
	s.LastSyncStatus = "failed"
	s.LastSyncError = short(message)
	now := time.Now().UTC()
	s.LastSyncAt = &now
	s.UpdatedAt = now
	r.servers[s.ID] = s
	r.audit = append([]AuditEvent{{ID: NewID(), Timestamp: now, Actor: actor, Action: "sync.failed", ServerID: s.ID, Metadata: map[string]interface{}{"error": s.LastSyncError}}}, r.audit...)
	return nil
}
func SnapshotHash(s CapabilitySnapshot) string {
	b, _ := json.Marshal([]interface{}{s.ProtocolVersion, s.ServerInfo, s.Capabilities, s.Tools, s.Resources, s.Prompts, s.RawInitialize})
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}
func NewID() string { return time.Now().UTC().Format("20060102150405.000000000") + "-" + randish() }
func randish() string {
	sum := sha256.Sum256([]byte(time.Now().String()))
	return hex.EncodeToString(sum[:4])
}
func slugify(v string) string {
	v = strings.ToLower(strings.TrimSpace(v))
	repl := strings.NewReplacer(" ", "-", "_", "-", "/", "-")
	if v == "" {
		return "server"
	}
	return repl.Replace(v)
}
func short(v string) string {
	v = strings.TrimSpace(v)
	if len(v) > 500 {
		return v[:500]
	}
	return v
}
