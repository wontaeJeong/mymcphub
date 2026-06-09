# Architecture

MCP Hub is a four-component internal catalog: Web, API, Worker, and CLI.

- Web is read-only and shows catalog, detail, liveness, and stored capability snapshots.
- API owns catalog metadata, admin mutations, snapshots, health checks, and audit events.
- Worker performs lightweight health checks and capability sync for `streamable_http` servers.
- CLI is the only management surface. It registers, updates, deletes, syncs remote servers, and performs local `stdio` sync.

Hub does not deploy, proxy, host, or execute MCP tools. Gateway, client config generation, grants, approvals, policy simulation, runtime hosting, rollout, usage accounting, compliance export, and first-party MCP servers are outside the MVP.
