# Auth and Policy Model

MCP Hub keeps authentication, authorization policy, approvals, and emergency deny state separate. The shared packages define the contracts, while the API and Gateway use local in-memory state in this skeleton.

## Authentication

Local development uses mock authentication by default.

- `@mcp-hub/auth` provides mock principals and mock bearer token verification.
- `dev-admin-token` maps to an admin-style principal with platform team access.
- `dev-readonly-token` maps to a non-admin read-only principal.
- The Control Plane API builds a default mock admin context unless `MCP_AUTH_MODE=oidc` is set.
- With `MCP_AUTH_MODE=oidc`, the API reads OIDC-compatible local headers such as `x-user-id`, `x-user-email`, `x-team-ids`, `x-groups`, `x-roles`, `x-client-id`, and `x-principal-type`.

`@mcp-hub/auth` also contains package-level OIDC JWT verifier support. `createOidcJwtVerifier` validates issuer, audience, trusted client ids, algorithms, clock tolerance, local JWKS, and claim mappings, then maps verified JWT claims into the shared principal shape. This support exists in the package, but the API and Gateway skeletons do not wire runtime JWKS configuration into request handling.

## Principal Shape

The API and Gateway normalize identity into fields the policy package can evaluate.

- Subject identity: `subject` in the shared auth package, exposed as `userId` in API and Gateway context.
- Principal type: `user`, `team`, or `service_account`.
- Client and token context: `clientId`, `issuer`, `audience`, `authSource`, and `tokenIssuer` where present.
- Human display context: `email` and `displayName` in the API.
- Grouping and role context: `teamIds`, `teams`, `groups`, and `roles`.
- Admin flags: `isAdmin` and `isPlatformAdmin` in API context, with `isPlatformAdmin` passed into Gateway policy input.

## Policy Input and Result

`@mcp-hub/policy` evaluates a `PolicyInput` with these high-level parts:

- `principal`: subject, principal type, teams, groups, roles, and platform admin flag.
- `action`: `connect`, `discover_tool`, `call_tool`, `read_resource`, `get_prompt`, `admin`, plus Gateway aliases `tools/list` and `tools/call`.
- `server`: id, slug, environment, enabled state, risk level, and optional tool list.
- `tool` or `toolName` for tool-call decisions.
- `clientId` or `client`, `projectId`, `requestTime`, active grant candidates, `emergencyDeny`, and `stepUpSatisfied`.

The result is a `PolicyDecision` with `effect` (`allow`, `deny`, or `needs_approval`), `allowed`, `reason`, `reasonCode`, matched grant ids, approval and step-up flags, and optional `discoverableToolNames` for discovery filtering.

## Authorization Rules

Policy evaluation is deny-first.

- Emergency deny runs before normal authorization.
- Admin actions require `principal.isPlatformAdmin`; platform admins receive an admin allow decision.
- Disabled servers are denied.
- Disabled or unregistered tools are denied for tool calls.
- Disabled grants, expired grants, wrong-project grants, wrong-principal grants, and wrong-server grants do not match.
- Production servers require an active `prod` grant. A grant for another environment is not enough.
- Connecting to a server requires at least one active grant for that server, project scope, principal, and environment.
- Tool discovery returns only enabled tools allowed by active environment grants.
- Tool calls are re-checked against the current server, tool, principal, project, grant, environment, and emergency state.
- Low and medium tools may use wildcard grants or explicit tool grants.
- High and critical tools require an explicit tool grant. A wildcard grant is not enough.
- High and critical explicit grants require approval through `approvedBy` before they allow execution.
- Critical tools also require `stepUpSatisfied`; otherwise the decision is `needs_approval` with `STEP_UP_REQUIRED`.

The policy package also keeps compatibility helpers for older Gateway-style inputs. Invalid environment or risk metadata denies instead of falling back to a weaker decision.

## Gateway Enforcement

The Gateway uses the shared policy package for MCP data-plane checks.

- On every `GET` or `POST /mcp/:serverSlug`, the Gateway validates the bearer token, finds the server, then checks `connect` before returning server status or handling MCP messages.
- `tools/list` maps to discovery policy and returns only `discoverableToolNames` from the decision.
- `tools/call` finds the requested tool and calls policy again before proxying upstream.
- Denied `tools/list` and `tools/call` requests return JSON-RPC errors and record audit data.

The Gateway registry, grants, emergency state, audit events, and metrics are in memory in this skeleton.

## API Approvals and Grants

The Control Plane API exposes grant and approval lifecycle endpoints over its in-memory store.

Approval records include `id`, `requesterId`, `subjectType`, `subjectId`, `projectId`, `serverId`, `requestedTools`, `environment`, optional `toolName`, `status`, `requestedAction`, `reason`, optional ticket and expiry fields, reviewer fields, decision fields, and timestamps.

The approval status type includes `pending`, `approved`, `rejected`, `cancelled`, and `expired`. Current routes create `pending` approvals and decide them as `approved` or `rejected`. When an approval is approved, the API creates an enabled grant from the approval, using reviewer, allowed tools, environment, expiry, reason, and ticket data from the approval or approval decision body.

Grant records include subject, project, server, allowed tools, environment, optional expiry, `approvedBy`, reason, ticket URL, enabled state, and creation time. Revocation disables the grant.

## Emergency Deny

Emergency deny state can be passed into shared policy evaluation or enabled through the API admin endpoint. The shared policy supports these scopes:

- Global deny, including the default when emergency deny is enabled with no scope.
- High and critical risk deny.
- Server deny by id or slug.
- Tool deny by name.
- Subject deny by principal subject.
- Client deny by client id.

The API stores emergency deny state in memory with `enabled`, `reason`, scope fields, and `createdAt`. This emergency state is not persisted to the database in the current skeleton.

## Current Skeleton Limits

- API data is in memory for servers, tools, grants, approvals, audit events, tool-call events, health, and emergency deny state.
- Gateway registry, grants, emergency state, audit events, and metrics are in memory.
- OIDC JWT verification exists in `@mcp-hub/auth`, but runtime JWKS configuration is not wired into API or Gateway request handling.
- Emergency deny state is not persisted to the database in this skeleton.
