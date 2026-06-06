export const seedIds = {
  adminUser: "00000000-0000-4000-8000-000000000001",
  platformTeam: "00000000-0000-4000-8000-000000000010",
  sampleProject: "00000000-0000-4000-8000-000000000020",
  echoServer: "00000000-0000-4000-8000-000000000100",
  internalDocsServer: "00000000-0000-4000-8000-000000000101",
  k8sReadonlyServer: "00000000-0000-4000-8000-000000000102",
  sampleGrant: "00000000-0000-4000-8000-000000000200"
} as const;

export const seedStatements = [
  `insert into users (id, email, display_name)
   values ('${seedIds.adminUser}', 'admin@example.com', 'Admin User')
   on conflict (id) do update set email = excluded.email, display_name = excluded.display_name`,
  `insert into teams (id, slug, display_name)
   values ('${seedIds.platformTeam}', 'platform', 'Platform Team')
   on conflict (id) do update set slug = excluded.slug, display_name = excluded.display_name`,
  `insert into team_memberships (team_id, user_id, role)
   values ('${seedIds.platformTeam}', '${seedIds.adminUser}', 'owner')
   on conflict (team_id, user_id) do update set role = excluded.role`,
  `insert into projects (id, slug, display_name, owner_team_id)
   values ('${seedIds.sampleProject}', 'sample-project', 'Sample Project', '${seedIds.platformTeam}')
   on conflict (id) do update set slug = excluded.slug, display_name = excluded.display_name`,
  `insert into mcp_servers (id, slug, display_name, description, owner_team_id, environment, transport, upstream_url, enabled, risk_level)
   values
     ('${seedIds.echoServer}', 'echo', 'Echo MCP Server', 'First-party echo MCP server.', '${seedIds.platformTeam}', 'dev', 'streamable_http', 'http://localhost:5100/mcp', true, 'low'),
     ('${seedIds.internalDocsServer}', 'internal-docs', 'Internal Docs MCP Server', 'First-party internal documentation MCP server.', '${seedIds.platformTeam}', 'dev', 'streamable_http', 'http://localhost:5101/mcp', true, 'medium'),
     ('${seedIds.k8sReadonlyServer}', 'k8s-readonly', 'Kubernetes Readonly MCP Server', 'Read-only Kubernetes MCP server.', '${seedIds.platformTeam}', 'dev', 'stdio_adapter', null, true, 'high')
   on conflict (id) do update set
     slug = excluded.slug,
     display_name = excluded.display_name,
     description = excluded.description,
     owner_team_id = excluded.owner_team_id,
     environment = excluded.environment,
     transport = excluded.transport,
     upstream_url = excluded.upstream_url,
     enabled = excluded.enabled,
     risk_level = excluded.risk_level,
     updated_at = now()`,
  `insert into mcp_grants (id, subject_type, subject_id, project_id, server_id, allowed_tools_json, environment, approved_by, reason, ticket_url, enabled)
   values ('${seedIds.sampleGrant}', 'team', '${seedIds.platformTeam}', '${seedIds.sampleProject}', '${seedIds.echoServer}', '["echo"]'::jsonb, 'dev', '${seedIds.adminUser}', 'Initial sample grant for local development.', null, true)
   on conflict (id) do update set enabled = excluded.enabled, allowed_tools_json = excluded.allowed_tools_json`
] as const;
