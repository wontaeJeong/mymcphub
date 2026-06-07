create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists team_memberships (
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  owner_team_id uuid not null references teams(id),
  created_at timestamptz not null default now()
);

create table if not exists project_memberships (
  project_id uuid not null references projects(id) on delete cascade,
  subject_type text not null check (subject_type in ('user', 'team', 'service_account')),
  subject_id text not null,
  role text not null,
  created_at timestamptz not null default now(),
  primary key (project_id, subject_type, subject_id)
);

create table if not exists mcp_servers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  description text,
  owner_team_id uuid not null references teams(id),
  environment text not null check (environment in ('dev', 'stg', 'prod', 'shared')),
  transport text not null check (transport in ('streamable_http', 'sse_legacy', 'stdio_adapter', 'external')),
  upstream_url text,
  enabled boolean not null default true,
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists mcp_server_versions (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references mcp_servers(id) on delete cascade,
  version text not null,
  image_ref text,
  manifest_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (server_id, version)
);

create table if not exists mcp_tools (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references mcp_servers(id) on delete cascade,
  name text not null,
  description text,
  enabled boolean not null default true,
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  discovered_at timestamptz not null default now(),
  last_seen_at timestamptz,
  unique (server_id, name)
);

create table if not exists mcp_tool_schemas (
  id uuid primary key default gen_random_uuid(),
  tool_id uuid not null references mcp_tools(id) on delete cascade,
  schema_hash text not null,
  input_schema_json jsonb not null,
  output_schema_json jsonb,
  description_snapshot text,
  version integer not null,
  created_at timestamptz not null default now(),
  unique (tool_id, version)
);

create table if not exists mcp_grants (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('user', 'team', 'service_account')),
  subject_id text not null,
  project_id uuid not null references projects(id) on delete cascade,
  server_id uuid not null references mcp_servers(id) on delete cascade,
  allowed_tools_json jsonb not null default '[]'::jsonb,
  environment text not null check (environment in ('dev', 'stg', 'prod', 'shared')),
  expires_at timestamptz,
  approved_by uuid references users(id),
  reason text not null,
  ticket_url text,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists approval_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references users(id),
  subject_type text not null check (subject_type in ('user', 'team', 'service_account')),
  subject_id text not null,
  project_id uuid not null references projects(id),
  server_id uuid not null references mcp_servers(id),
  requested_tools_json jsonb not null default '[]'::jsonb,
  environment text not null check (environment in ('dev', 'stg', 'prod', 'shared')),
  tool_name text,
  status text not null check (status in ('pending', 'approved', 'rejected', 'cancelled', 'expired')),
  requested_action text not null,
  reason text not null,
  ticket_url text,
  requested_expires_at timestamptz,
  reviewer_id uuid references users(id),
  review_comment text,
  decided_by uuid references users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata_json jsonb not null default '{}'::jsonb
);

create table if not exists oauth_clients (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  display_name text not null,
  owner_team_id uuid not null references teams(id),
  redirect_uris_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists mcp_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  team_id uuid references teams(id),
  project_id uuid references projects(id),
  client_id uuid references oauth_clients(id),
  gateway_session_id text not null unique,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb
);

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  timestamp timestamptz not null default now(),
  user_id uuid references users(id),
  team_id uuid references teams(id),
  project_id uuid references projects(id),
  client_id uuid references oauth_clients(id),
  session_id uuid references mcp_sessions(id),
  server_id uuid references mcp_servers(id),
  tool_name text,
  event_type text not null,
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  policy_decision text not null check (policy_decision in ('allow', 'deny', 'needs_approval')),
  argument_hash text,
  argument_redacted_json jsonb,
  upstream_status integer,
  latency_ms integer,
  trace_id text not null,
  metadata_json jsonb not null default '{}'::jsonb
);

create table if not exists tool_call_events (
  id uuid primary key default gen_random_uuid(),
  audit_event_id uuid not null references audit_events(id) on delete cascade,
  server_id uuid not null references mcp_servers(id),
  tool_name text not null,
  status text not null,
  latency_ms integer,
  input_schema_hash text,
  argument_hash text,
  created_at timestamptz not null default now()
);

create table if not exists server_health_checks (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references mcp_servers(id) on delete cascade,
  status text not null check (status in ('healthy', 'degraded', 'unhealthy')),
  latency_ms integer,
  error_message text,
  checked_at timestamptz not null default now(),
  metadata_json jsonb not null default '{}'::jsonb
);

create table if not exists secret_refs (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('server', 'project', 'team')),
  scope_id text not null,
  provider text not null,
  ref_key text not null,
  description text,
  created_at timestamptz not null default now(),
  unique (scope_type, scope_id, provider, ref_key)
);

create table if not exists policy_versions (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  policy_json jsonb not null,
  created_by uuid references users(id),
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_mcp_servers_owner_team_id on mcp_servers(owner_team_id);
create index if not exists idx_mcp_tools_server_id on mcp_tools(server_id);
create index if not exists idx_mcp_grants_subject on mcp_grants(subject_type, subject_id);
create index if not exists idx_audit_events_trace_id on audit_events(trace_id);
create index if not exists idx_audit_events_timestamp on audit_events(timestamp);
create index if not exists idx_server_health_checks_server_id on server_health_checks(server_id, checked_at desc);
