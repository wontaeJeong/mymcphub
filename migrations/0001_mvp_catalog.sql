create table if not exists mcp_servers (
  id text primary key, slug text not null unique, name text not null, description text not null default '',
  transport text not null check (transport in ('streamable_http','stdio')),
  hosting_type text not null, owner_team text not null, contact text not null default '', repository_url text not null default '', runbook_url text not null default '',
  environment text not null check (environment in ('dev','stg','prod','shared')),
  status text not null check (status in ('draft','active','disabled')),
  liveness_status text not null check (liveness_status in ('unknown','healthy','degraded','offline')),
  endpoint_url text, stdio_command text, stdio_args jsonb not null default '[]', stdio_env_keys jsonb not null default '[]', tags jsonb not null default '[]',
  created_at timestamptz not null, updated_at timestamptz not null, last_sync_at timestamptz, last_sync_status text not null default 'never', last_sync_error text
);
create table if not exists capability_snapshots (
  id text primary key, server_id text not null references mcp_servers(id) on delete cascade, source text not null,
  protocol_version text not null default '', server_info_json jsonb not null default '{}', capabilities_json jsonb not null default '{}',
  tools_json jsonb not null default '[]', resources_json jsonb not null default '[]', prompts_json jsonb not null default '[]', raw_initialize_json jsonb not null default '{}',
  snapshot_hash text not null, captured_at timestamptz not null, created_by text not null
);
create index if not exists idx_capability_snapshots_latest on capability_snapshots(server_id, captured_at desc);
create table if not exists server_health_checks (id text primary key, server_id text not null references mcp_servers(id) on delete cascade, status text not null, latency_ms bigint not null, checked_at timestamptz not null, error_message text not null default '');
create table if not exists audit_events (id text primary key, timestamp timestamptz not null, actor text not null, action text not null, server_id text, metadata_json jsonb not null default '{}');
