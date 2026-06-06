# MCP Hub Architecture

## Control Plane

The Control Plane contains `apps/api`, `apps/web`, and `apps/worker`.

- `apps/api` owns catalog, grant, approval, and audit-search APIs.
- `apps/web` provides the operator and developer interface.
- `apps/worker` runs tool scans, schema diffs, health checks, and risk classification jobs.

## Data Plane

The Data Plane contains `apps/gateway`, managed first-party MCP servers under `servers/*`, stdio adapter workloads, and external remote MCP servers.

The gateway is responsible for token validation, session routing, tool-list filtering, tool-call authorization, audit logging, timeout handling, and upstream health awareness.

## Runtime Plane

The Runtime Plane is where managed MCP servers and stdio adapter pods execute. It keeps tool execution separate from the Control Plane so operators can disable servers, tools, grants, or emergency policies without redeploying the web or API services.

## Dependency Direction

Shared packages under `packages/*` provide contracts and utilities used by apps and servers. Control Plane packages should not depend on Data Plane runtime implementations. Gateway policy checks should use shared contracts from `packages/auth`, `packages/mcp-protocol`, and `packages/policy`.
