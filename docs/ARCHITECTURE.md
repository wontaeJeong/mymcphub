# MCP Hub Architecture

## Control Plane

The Control Plane contains `apps/api`, `apps/web`, and `apps/worker`.

- `apps/api` owns catalog, grant, approval, and audit-search APIs.
- `apps/web` provides the operator and developer interface.
- `apps/worker` runs tool scans, schema diffs, health checks, and risk classification jobs.

## Data Plane

The Data Plane contains `apps/gateway`, managed first-party MCP servers under `servers/*`, stdio adapter workloads, and external remote MCP servers.

The gateway is responsible for token validation, session routing, tool-list filtering, tool-call authorization, audit logging, timeout handling, and upstream health awareness.

The stdio adapter runtime in `apps/stdio-adapter` is the only component that spawns stdio MCP server processes. Gateway registrations with transport `stdio_adapter` still point at an HTTP JSON-RPC upstream URL, such as `http://localhost:5103/mcp`, so the gateway remains a pure HTTP proxy and does not import subprocess logic.

## Runtime Plane

The Runtime Plane is where managed MCP servers and stdio adapter pods execute. It keeps tool execution separate from the Control Plane so operators can disable servers, tools, grants, or emergency policies without redeploying the web or API services.

Each stdio adapter instance owns one child process, preserves newline-delimited stdin/stdout JSON-RPC frames, collects stderr as health/status logs, and serializes requests through a FIFO queue with timeout and queue-depth limits.

## Dependency Direction

Shared packages under `packages/*` provide contracts and utilities used by apps and servers. Control Plane packages should not depend on Data Plane runtime implementations. Gateway policy checks should use shared contracts from `packages/auth`, `packages/mcp-protocol`, and `packages/policy`.
