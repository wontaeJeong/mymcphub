export const seedIds = {
  adminUser: "00000000-0000-4000-8000-000000000001",
  platformTeam: "00000000-0000-4000-8000-000000000010",
  sampleProject: "00000000-0000-4000-8000-000000000020",
  echoServer: "00000000-0000-4000-8000-000000000100",
  internalDocsServer: "00000000-0000-4000-8000-000000000101",
  k8sReadonlyServer: "00000000-0000-4000-8000-000000000102",
  stdioSampleServer: "00000000-0000-4000-8000-000000000103",
  sampleGrant: "00000000-0000-4000-8000-000000000200",
  stdioSampleGrant: "00000000-0000-4000-8000-000000000201"
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
      ('${seedIds.k8sReadonlyServer}', 'k8s-readonly', 'Kubernetes Readonly MCP Server', 'Read-only Kubernetes MCP server with local mock mode.', '${seedIds.platformTeam}', 'dev', 'streamable_http', 'http://localhost:5102/mcp', true, 'medium'),
      ('${seedIds.stdioSampleServer}', 'stdio-sample', 'stdio Sample MCP Server', 'First-party stdio MCP server exposed through the stdio adapter runtime.', '${seedIds.platformTeam}', 'dev', 'stdio_adapter', 'http://localhost:5103/mcp', true, 'low')
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
  `insert into mcp_tools (server_id, name, description, enabled, risk_level)
    values
      ('${seedIds.echoServer}', 'echo_message', 'Return the provided message unchanged.', true, 'low'),
      ('${seedIds.echoServer}', 'get_server_time', 'Return the current server time as an ISO-8601 timestamp.', true, 'low'),
      ('${seedIds.internalDocsServer}', 'search_docs', 'Search synthetic internal documentation by keyword.', true, 'low'),
      ('${seedIds.internalDocsServer}', 'read_doc', 'Read one synthetic internal document by id.', true, 'low'),
      ('${seedIds.k8sReadonlyServer}', 'list_namespaces', 'List namespace names from the local read-only mock Kubernetes dataset.', true, 'medium'),
      ('${seedIds.k8sReadonlyServer}', 'list_pods', 'List pods in one namespace from the local read-only mock Kubernetes dataset.', true, 'medium'),
      ('${seedIds.k8sReadonlyServer}', 'get_pod', 'Read one pod by namespace and name from the local read-only mock Kubernetes dataset.', true, 'medium'),
      ('${seedIds.stdioSampleServer}', 'stdio_echo', 'Return the provided message and metadata from the stdio sample server.', true, 'low'),
      ('${seedIds.stdioSampleServer}', 'get_stdio_status', 'Return process and uptime status for the stdio sample server.', true, 'low')
    on conflict (server_id, name) do update set
      description = excluded.description,
      enabled = excluded.enabled,
      risk_level = excluded.risk_level,
      last_seen_at = now()`,
  `insert into mcp_grants (id, subject_type, subject_id, project_id, server_id, allowed_tools_json, environment, approved_by, reason, ticket_url, enabled)
    values
      ('${seedIds.sampleGrant}', 'team', '${seedIds.platformTeam}', '${seedIds.sampleProject}', '${seedIds.echoServer}', '["echo_message","get_server_time"]'::jsonb, 'dev', '${seedIds.adminUser}', 'Initial sample grant for local development.', null, true),
      ('${seedIds.stdioSampleGrant}', 'team', '${seedIds.platformTeam}', '${seedIds.sampleProject}', '${seedIds.stdioSampleServer}', '["stdio_echo","get_stdio_status"]'::jsonb, 'dev', '${seedIds.adminUser}', 'Initial stdio adapter sample grant for local development.', null, true)
    on conflict (id) do update set enabled = excluded.enabled, allowed_tools_json = excluded.allowed_tools_json`
] as const;
