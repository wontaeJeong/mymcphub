# Architecture

MCP Hub now uses Go for the core runtime and first-party MCP servers. TypeScript remains only in the Web UI surface.

## Runtime Planes

- Control Plane: `apps/api/cmd/api` serves catalog, grants, approvals, audit, policy, admin, and client-config APIs.
- Data Plane: `apps/gateway/cmd/gateway` serves `/mcp/{serverSlug}` and enforces auth, policy, discovery filtering, redaction, SSRF checks, circuit breaking, and audit.
- Worker Plane: `apps/worker/cmd/worker` runs health, scan, schema-diff, cleanup, and audit-export jobs.
- Operator Plane: `apps/cli/cmd/mcphubctl` calls the Control Plane API. It does not mutate DB, Kubernetes, or secrets directly.
- Web Plane: `apps/web` remains Next.js and consumes `apps/web/lib/generated/mcp-hub-client.ts`.

## Shared Go Packages

`internal/` contains auth, audit, config, db, errors-by-envelope through `httpx`, jobs, logger, MCP JSON-RPC helpers, policy, rate limiting, redaction, and telemetry hooks.

## State and Persistence

The current Go core preserves the previous skeleton behavior with an in-memory store seeded from the same catalog/grant data. Durable PostgreSQL repository wiring is recorded in `docs/IMPLEMENTATION_NOTES.md` because the prompt forbids arbitrary DB schema changes.

## Contracts

OpenAPI and JSON Schemas in `schemas/` are source of truth. Go uses validated handwritten types under `internal/db`; Web uses the generated TypeScript client boundary.
