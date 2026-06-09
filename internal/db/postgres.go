package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

type PostgresRepository struct{ db *sql.DB }

func OpenPostgres(ctx context.Context, databaseURL string) (*PostgresRepository, error) {
	d, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return nil, err
	}
	if err := d.PingContext(ctx); err != nil {
		_ = d.Close()
		return nil, err
	}
	if _, err := d.ExecContext(ctx, "select 1 from mcp_servers limit 1"); err != nil {
		_ = d.Close()
		return nil, err
	}
	return &PostgresRepository{db: d}, nil
}
func (r *PostgresRepository) Ready(ctx context.Context) error { return r.db.PingContext(ctx) }
func (r *PostgresRepository) Summary(ctx context.Context) (Summary, error) {
	items, err := r.ListServers(ctx, nil)
	if err != nil {
		return Summary{}, err
	}
	cutoff := time.Now().Add(-7 * 24 * time.Hour)
	var s Summary
	for _, v := range items {
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
func (r *PostgresRepository) ListServers(ctx context.Context, f map[string]string) ([]Server, error) {
	rows, err := r.db.QueryContext(ctx, `select id,slug,name,description,transport,hosting_type,owner_team,contact,repository_url,runbook_url,environment,status,liveness_status,coalesce(endpoint_url,''),coalesce(stdio_command,''),stdio_args,stdio_env_keys,tags,created_at,updated_at,last_sync_at,last_sync_status,coalesce(last_sync_error,''),coalesce((select jsonb_array_length(tools_json) from capability_snapshots where server_id=mcp_servers.id order by captured_at desc limit 1),0),coalesce((select jsonb_array_length(resources_json) from capability_snapshots where server_id=mcp_servers.id order by captured_at desc limit 1),0),coalesce((select jsonb_array_length(prompts_json) from capability_snapshots where server_id=mcp_servers.id order by captured_at desc limit 1),0),coalesce((select snapshot_hash from capability_snapshots where server_id=mcp_servers.id order by captured_at desc limit 1),'') from mcp_servers order by name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Server{}
	for rows.Next() {
		s, err := scanServer(rows)
		if err != nil {
			return nil, err
		}
		if matchServer(s, f) {
			out = append(out, s)
		}
	}
	return out, rows.Err()
}

type scanner interface{ Scan(...interface{}) error }

func scanServer(row scanner) (Server, error) {
	var s Server
	var args, env, tags []byte
	err := row.Scan(&s.ID, &s.Slug, &s.Name, &s.Description, &s.Transport, &s.HostingType, &s.OwnerTeam, &s.Contact, &s.RepositoryURL, &s.RunbookURL, &s.Environment, &s.Status, &s.LivenessStatus, &s.EndpointURL, &s.StdioCommand, &args, &env, &tags, &s.CreatedAt, &s.UpdatedAt, &s.LastSyncAt, &s.LastSyncStatus, &s.LastSyncError, &s.ToolCount, &s.ResourceCount, &s.PromptCount, &s.SnapshotHash)
	_ = json.Unmarshal(args, &s.StdioArgs)
	_ = json.Unmarshal(env, &s.StdioEnvKeys)
	_ = json.Unmarshal(tags, &s.Tags)
	return s, err
}
func (r *PostgresRepository) GetServer(ctx context.Context, id string) (Server, error) {
	row := r.db.QueryRowContext(ctx, `select id,slug,name,description,transport,hosting_type,owner_team,contact,repository_url,runbook_url,environment,status,liveness_status,coalesce(endpoint_url,''),coalesce(stdio_command,''),stdio_args,stdio_env_keys,tags,created_at,updated_at,last_sync_at,last_sync_status,coalesce(last_sync_error,''),coalesce((select jsonb_array_length(tools_json) from capability_snapshots where server_id=mcp_servers.id order by captured_at desc limit 1),0),coalesce((select jsonb_array_length(resources_json) from capability_snapshots where server_id=mcp_servers.id order by captured_at desc limit 1),0),coalesce((select jsonb_array_length(prompts_json) from capability_snapshots where server_id=mcp_servers.id order by captured_at desc limit 1),0),coalesce((select snapshot_hash from capability_snapshots where server_id=mcp_servers.id order by captured_at desc limit 1),'') from mcp_servers where id=$1 or slug=$1`, id)
	s, err := scanServer(row)
	if errors.Is(err, sql.ErrNoRows) {
		return Server{}, ErrNotFound
	}
	return s, err
}
func (r *PostgresRepository) CreateServer(ctx context.Context, s Server, actor string) (Server, error) {
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
	args, _ := json.Marshal(s.StdioArgs)
	env, _ := json.Marshal(s.StdioEnvKeys)
	tags, _ := json.Marshal(s.Tags)
	_, err := r.db.ExecContext(ctx, `insert into mcp_servers(id,slug,name,description,transport,hosting_type,owner_team,contact,repository_url,runbook_url,environment,status,liveness_status,endpoint_url,stdio_command,stdio_args,stdio_env_keys,tags,created_at,updated_at,last_sync_status) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`, s.ID, s.Slug, s.Name, s.Description, s.Transport, s.HostingType, s.OwnerTeam, s.Contact, s.RepositoryURL, s.RunbookURL, s.Environment, s.Status, s.LivenessStatus, nullEmpty(s.EndpointURL), nullEmpty(s.StdioCommand), args, env, tags, s.CreatedAt, s.UpdatedAt, s.LastSyncStatus)
	if err != nil {
		return Server{}, err
	}
	_ = r.audit(ctx, actor, "server.created", s.ID, map[string]interface{}{"slug": s.Slug})
	return s, nil
}
func (r *PostgresRepository) PatchServer(ctx context.Context, id string, p ServerPatch, actor string) (Server, error) {
	s, err := r.GetServer(ctx, id)
	if err != nil {
		return Server{}, err
	}
	apply(&s, p.Server)
	s.UpdatedAt = time.Now().UTC()
	args, _ := json.Marshal(s.StdioArgs)
	env, _ := json.Marshal(s.StdioEnvKeys)
	tags, _ := json.Marshal(s.Tags)
	_, err = r.db.ExecContext(ctx, `update mcp_servers set name=$2,description=$3,transport=$4,hosting_type=$5,owner_team=$6,contact=$7,repository_url=$8,runbook_url=$9,environment=$10,status=$11,endpoint_url=$12,stdio_command=$13,stdio_args=$14,stdio_env_keys=$15,tags=$16,updated_at=$17 where id=$1`, s.ID, s.Name, s.Description, s.Transport, s.HostingType, s.OwnerTeam, s.Contact, s.RepositoryURL, s.RunbookURL, s.Environment, s.Status, nullEmpty(s.EndpointURL), nullEmpty(s.StdioCommand), args, env, tags, s.UpdatedAt)
	if err != nil {
		return Server{}, err
	}
	_ = r.audit(ctx, actor, "server.updated", s.ID, map[string]interface{}{"slug": s.Slug})
	return s, nil
}
func (r *PostgresRepository) DeleteServer(ctx context.Context, id, actor string) error {
	s, err := r.GetServer(ctx, id)
	if err != nil {
		return err
	}
	_, err = r.db.ExecContext(ctx, `delete from mcp_servers where id=$1`, s.ID)
	if err == nil {
		_ = r.audit(ctx, actor, "server.deleted", s.ID, map[string]interface{}{"slug": s.Slug})
	}
	return err
}
func (r *PostgresRepository) SaveSnapshot(ctx context.Context, id string, snap CapabilitySnapshot, actor string) (CapabilitySnapshot, error) {
	srv, err := r.GetServer(ctx, id)
	if err != nil {
		return CapabilitySnapshot{}, err
	}
	now := time.Now().UTC()
	if snap.ID == "" {
		snap.ID = NewID()
	}
	snap.ServerID = srv.ID
	if snap.CapturedAt.IsZero() {
		snap.CapturedAt = now
	}
	if snap.CreatedBy == "" {
		snap.CreatedBy = actor
	}
	if snap.SnapshotHash == "" {
		snap.SnapshotHash = SnapshotHash(snap)
	}
	si, _ := json.Marshal(snap.ServerInfo)
	cap, _ := json.Marshal(snap.Capabilities)
	tools, _ := json.Marshal(snap.Tools)
	res, _ := json.Marshal(snap.Resources)
	prompts, _ := json.Marshal(snap.Prompts)
	raw, _ := json.Marshal(snap.RawInitialize)
	_, err = r.db.ExecContext(ctx, `insert into capability_snapshots(id,server_id,source,protocol_version,server_info_json,capabilities_json,tools_json,resources_json,prompts_json,raw_initialize_json,snapshot_hash,captured_at,created_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, snap.ID, snap.ServerID, snap.Source, snap.ProtocolVersion, si, cap, tools, res, prompts, raw, snap.SnapshotHash, snap.CapturedAt, snap.CreatedBy)
	if err != nil {
		return CapabilitySnapshot{}, err
	}
	_, err = r.db.ExecContext(ctx, `update mcp_servers set last_sync_at=$2,last_sync_status='success',last_sync_error=null,updated_at=$2 where id=$1`, srv.ID, now)
	if err == nil {
		_ = r.audit(ctx, actor, "snapshot.saved", srv.ID, map[string]interface{}{"hash": snap.SnapshotHash, "source": snap.Source})
	}
	return snap, err
}
func (r *PostgresRepository) LatestSnapshot(ctx context.Context, id string) (CapabilitySnapshot, error) {
	srv, err := r.GetServer(ctx, id)
	if err != nil {
		return CapabilitySnapshot{}, err
	}
	row := r.db.QueryRowContext(ctx, `select id,server_id,source,protocol_version,server_info_json,capabilities_json,tools_json,resources_json,prompts_json,raw_initialize_json,snapshot_hash,captured_at,created_by from capability_snapshots where server_id=$1 order by captured_at desc limit 1`, srv.ID)
	var snap CapabilitySnapshot
	var si, cap, tools, res, prompts, raw []byte
	err = row.Scan(&snap.ID, &snap.ServerID, &snap.Source, &snap.ProtocolVersion, &si, &cap, &tools, &res, &prompts, &raw, &snap.SnapshotHash, &snap.CapturedAt, &snap.CreatedBy)
	if errors.Is(err, sql.ErrNoRows) {
		return CapabilitySnapshot{}, ErrNotFound
	}
	_ = json.Unmarshal(si, &snap.ServerInfo)
	_ = json.Unmarshal(cap, &snap.Capabilities)
	_ = json.Unmarshal(tools, &snap.Tools)
	_ = json.Unmarshal(res, &snap.Resources)
	_ = json.Unmarshal(prompts, &snap.Prompts)
	_ = json.Unmarshal(raw, &snap.RawInitialize)
	return snap, err
}
func (r *PostgresRepository) AddHealth(ctx context.Context, h HealthCheck) error {
	if h.ID == "" {
		h.ID = NewID()
	}
	if h.CheckedAt.IsZero() {
		h.CheckedAt = time.Now().UTC()
	}
	_, err := r.db.ExecContext(ctx, `insert into server_health_checks(id,server_id,status,latency_ms,checked_at,error_message) values($1,$2,$3,$4,$5,$6)`, h.ID, h.ServerID, h.Status, h.LatencyMS, h.CheckedAt, h.ErrorMessage)
	if err != nil {
		return err
	}
	_, err = r.db.ExecContext(ctx, `update mcp_servers set liveness_status=$2,updated_at=$3 where id=$1`, h.ServerID, h.Status, time.Now().UTC())
	return err
}
func (r *PostgresRepository) ListHealth(ctx context.Context, id string) ([]HealthCheck, error) {
	srv, err := r.GetServer(ctx, id)
	if err != nil {
		return nil, err
	}
	rows, err := r.db.QueryContext(ctx, `select id,server_id,status,latency_ms,checked_at,error_message from server_health_checks where server_id=$1 order by checked_at desc limit 50`, srv.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []HealthCheck{}
	for rows.Next() {
		var h HealthCheck
		if err := rows.Scan(&h.ID, &h.ServerID, &h.Status, &h.LatencyMS, &h.CheckedAt, &h.ErrorMessage); err != nil {
			return nil, err
		}
		out = append(out, h)
	}
	return out, rows.Err()
}
func (r *PostgresRepository) ListAudit(ctx context.Context, serverID string) ([]AuditEvent, error) {
	q := `select id,timestamp,actor,action,coalesce(server_id,''),metadata_json from audit_events`
	args := []interface{}{}
	if serverID != "" {
		q += ` where server_id=$1`
		args = append(args, serverID)
	}
	q += ` order by timestamp desc limit 100`
	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []AuditEvent{}
	for rows.Next() {
		var e AuditEvent
		var m []byte
		if err := rows.Scan(&e.ID, &e.Timestamp, &e.Actor, &e.Action, &e.ServerID, &m); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(m, &e.Metadata)
		out = append(out, e)
	}
	return out, rows.Err()
}
func (r *PostgresRepository) MarkSyncFailed(ctx context.Context, id, message, actor string) error {
	srv, err := r.GetServer(ctx, id)
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	_, err = r.db.ExecContext(ctx, `update mcp_servers set last_sync_at=$2,last_sync_status='failed',last_sync_error=$3,updated_at=$2 where id=$1`, srv.ID, now, short(message))
	if err == nil {
		_ = r.audit(ctx, actor, "sync.failed", srv.ID, map[string]interface{}{"error": short(message)})
	}
	return err
}
func (r *PostgresRepository) audit(ctx context.Context, actor, action, serverID string, meta map[string]interface{}) error {
	b, _ := json.Marshal(meta)
	_, err := r.db.ExecContext(ctx, `insert into audit_events(id,timestamp,actor,action,server_id,metadata_json) values($1,$2,$3,$4,$5,$6)`, NewID(), time.Now().UTC(), actor, action, nullEmpty(serverID), b)
	return err
}
func nullEmpty(v string) interface{} {
	if v == "" {
		return nil
	}
	return v
}
func RepositoryFromEnv(ctx context.Context, databaseURL string) *MemoryRepository {
	return NewMemoryRepository()
}
func OpenRepository(ctx context.Context, databaseURL string) (Repository, error) {
	if databaseURL == "" {
		return NewMemoryRepository(), nil
	}
	pg, err := OpenPostgres(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("open postgres: %w", err)
	}
	return pg, nil
}
