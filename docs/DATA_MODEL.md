# Data Model

MCP Hub separates identity, catalog, authorization, runtime session, audit, and operations data. The current Go skeleton uses `internal/db` as an in-memory store that preserves the previous local behavior.

Preserved SQL migration artifacts live in `internal/db/migrations`. Durable PostgreSQL repository wiring is pending and tracked in `docs/IMPLEMENTATION_NOTES.md`.

## Current Store Areas

- Tenancy users, teams, team memberships, projects, and project memberships.
- Servers, versions, rollout metadata, tools, grants, approvals, audit events, audit export jobs, tool-call events, health checks, and emergency deny.
- Secret binding metadata with provider refs and lease metadata only; plaintext secret values are not stored.
- Tool schema snapshots and schema diff history with approval state.
- Gateway catalog snapshots and grants consumed from the same Go store.
- Worker job results written as health rows, audit events, schema snapshots, and schema diffs.

## Neutral Schemas

Runtime contracts live in `schemas/openapi/mcp-hub.openapi.yaml` and `schemas/jsonschema/`, with Go domain types under `internal/db`.
