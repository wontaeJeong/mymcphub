alter table mcp_servers add column if not exists published boolean not null default true;
alter table mcp_servers add column if not exists quarantined boolean not null default false;

alter table mcp_server_versions add column if not exists rollout_status text;
alter table mcp_server_versions add column if not exists rollout_message text;
alter table mcp_server_versions add column if not exists gitops_repo text;
alter table mcp_server_versions add column if not exists gitops_path text;
alter table mcp_server_versions add column if not exists gitops_revision text;
alter table mcp_server_versions add column if not exists updated_at timestamptz not null default now();
alter table mcp_server_versions add column if not exists rolled_back_at timestamptz;

alter table audit_events add column if not exists error_code text;

alter table secret_refs add column if not exists lease_expires_at timestamptz;
alter table secret_refs add column if not exists lease_renewable boolean not null default false;
alter table secret_refs add column if not exists last_rotated_at timestamptz;
alter table secret_refs add column if not exists updated_at timestamptz not null default now();

create table if not exists mcp_tool_schema_snapshots (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references mcp_servers(id) on delete cascade,
  version_id uuid references mcp_server_versions(id) on delete set null,
  source text not null,
  tools_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists mcp_tool_schema_diffs (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references mcp_servers(id) on delete cascade,
  from_version_id uuid references mcp_server_versions(id) on delete set null,
  to_version_id uuid references mcp_server_versions(id) on delete set null,
  from_snapshot_id uuid references mcp_tool_schema_snapshots(id) on delete set null,
  to_snapshot_id uuid references mcp_tool_schema_snapshots(id) on delete set null,
  status text not null,
  approval_required boolean not null default false,
  approval_state text not null default 'not_required',
  changes_json jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now()
);

create table if not exists emergency_denies (
  id uuid primary key default gen_random_uuid(),
  enabled boolean not null default true,
  reason text not null,
  global boolean not null default false,
  high_critical boolean not null default false,
  server_ids_json jsonb not null default '[]'::jsonb,
  server_slugs_json jsonb not null default '[]'::jsonb,
  tool_names_json jsonb not null default '[]'::jsonb,
  subject_ids_json jsonb not null default '[]'::jsonb,
  client_ids_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists audit_export_jobs (
  id uuid primary key default gen_random_uuid(),
  status text not null,
  format text not null,
  filters_json jsonb not null default '{}'::jsonb,
  requested_by uuid references users(id),
  requested_at timestamptz not null default now()
);

create index if not exists idx_mcp_servers_catalog_filters on mcp_servers(environment, risk_level, owner_team_id);
create index if not exists idx_mcp_tool_schema_snapshots_server_created on mcp_tool_schema_snapshots(server_id, created_at desc);
create index if not exists idx_mcp_tool_schema_diffs_server_generated on mcp_tool_schema_diffs(server_id, generated_at desc);
create index if not exists idx_audit_export_jobs_requested_at on audit_export_jobs(requested_at desc);
