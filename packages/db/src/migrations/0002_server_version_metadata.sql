alter table mcp_server_versions add column if not exists image_repository text;
alter table mcp_server_versions add column if not exists image_tag text;
alter table mcp_server_versions add column if not exists image_digest text;
alter table mcp_server_versions add column if not exists config_hash text;
alter table mcp_server_versions add column if not exists tool_schema_hash text;
alter table mcp_server_versions add column if not exists status text not null default 'draft';
alter table mcp_server_versions add column if not exists created_by uuid references users(id);
alter table mcp_server_versions add column if not exists activated_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'mcp_server_versions_status_check'
      and conrelid = 'mcp_server_versions'::regclass
  ) then
    alter table mcp_server_versions
      add constraint mcp_server_versions_status_check
      check (status in ('draft', 'pending', 'active', 'deprecated', 'rolled_back'));
  end if;
end $$;

create index if not exists idx_mcp_server_versions_server_status on mcp_server_versions(server_id, status);
create index if not exists idx_mcp_server_versions_active on mcp_server_versions(server_id, activated_at desc) where status = 'active';
create index if not exists idx_mcp_server_versions_image_digest on mcp_server_versions(image_digest) where image_digest is not null;
