# MCP Server Onboarding

Use this lifecycle when adding or promoting an MCP server through MCP Hub. The current skeleton supports manifests, seed data, Web/API catalog views, Gateway routing, policy review, local smoke checks, and release metadata placeholders. It does not run a real runtime `tools/list` scanner yet.

## Lifecycle Checklist

| Step | Operator action | Current skeleton truth |
| --- | --- | --- |
| manifest 작성 | Create or update `servers/<name>/mcp-server.manifest.json` with slug, owner team, transport, upstream URL, risk level, and tool schemas. | `pnpm security:mcp-manifests` validates first-party manifests. |
| owner team 지정 | Assign `ownerTeam` and `ownerTeamId` to the team accountable for tools, incidents, and approvals. | Seed data uses the platform team for first-party servers. |
| transport 선택 | Choose `streamable_http` for direct HTTP MCP servers. | Gateway proxies HTTP JSON-RPC upstream URLs. |
| local test | Start the upstream and call its `/health`, then call through the Gateway. | The seeded first-party server uses port `5102`. |
| tools/list scan | Capture expected `tools/list` output and compare schemas with the manifest. | Worker has a schema diff helper and placeholder job, but no real runtime scanner is wired yet. |
| risk review | Review server and tool risk levels, closed schemas, dangerous names, and high or critical tool descriptions. | `pnpm security:mcp-manifests` warns on dangerous keywords and fails missing required risk/schema fields. |
| secret binding | Bind any required secrets through approved secret references or deployment environment. | Do not put secret values in manifests, docs, Helm values, or committed files. |
| dev 등록 | Register the server in dev catalog data and verify Web `/catalog`, `/servers/:serverId`, and Gateway routing. | API catalog state is in memory unless represented by seed or current process state. |
| stg promotion | Promote the same manifest and image digest to staging after local and dev checks pass. | Use release docs for Helm values and digest promotion. |
| prod approval | Get owner and platform approval before production grants or high-risk tools are enabled. | High and critical tool grants require explicit approval in policy. |
| monitoring 확인 | Confirm metrics, audit events, health status, and runbook coverage. | API/Gateway metrics exist. Audit and health are in-memory skeletons. |

## Manifest 작성

First-party manifests live at `servers/*/mcp-server.manifest.json`. Include at least:

1. Stable `slug` used by the Gateway route `/mcp/:serverSlug`.
2. Human-readable name and description.
3. `ownerTeam` and `ownerTeamId`.
4. `transport`, usually `streamable_http`.
5. `upstreamUrl`, such as `http://localhost:5102/mcp`.
6. Server `riskLevel`.
7. Tool entries with `name`, description, `riskLevel`, and closed input schemas.

Run manifest checks:

```sh
pnpm security:mcp-manifests
pnpm security:mcp-manifests -- servers/k8s/mcp-server.manifest.json
```

## Owner Team 지정

Every server needs an owner team before shared use. The owner team handles:

1. Tool behavior review.
2. Incident response and runbook ownership.
3. Grant approval requests.
4. Schema breaking-change decisions.
5. Secret rotation and upstream lifecycle.

## Transport 선택

Use `streamable_http` when the MCP server exposes HTTP JSON-RPC. The current first-party runtime is Go HTTP.

## Local Test

For the seeded k8s server:

```sh
pnpm dev
curl http://localhost:5102/health
curl http://localhost:5000/mcp/k8s-readonly -H 'authorization: Bearer dev-admin-token'
curl http://localhost:5000/mcp/k8s-readonly \
  -H 'authorization: Bearer dev-admin-token' \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Run the full local check after the stack is up:

```sh
pnpm dev:smoke-test
```

## Tools/List Scan

Capture the `tools/list` output and compare it to the manifest before registering or promoting. Today this is a manual or test-driven check. The Worker has pure schema diff helpers and metrics skeletons, but it reports the runtime scanner path as a placeholder when no snapshots are supplied.

Review `GET /api/servers/:serverId/schema-diff` for current in-memory schema diff metadata. Do not treat it as proof that a live upstream scan has happened in this skeleton.

## Risk Review

Review every high or critical tool before shared use. High and critical tools need explicit grants and approvals in policy. Check for:

1. Write, admin, deploy, cluster, secret, credential, token, shell, exec, delete, or merge behavior.
2. Missing `readOnly` intent for dangerous tools.
3. Input schemas that allow unknown properties.
4. Tool descriptions that hide side effects.
5. Owner team readiness for incident response.

## Secret Binding

Do not store secrets in manifests. Use environment variables, Kubernetes Secrets, an external secret controller, or an approved sealed secret workflow. Keep docs examples limited to local mock token values such as `dev-admin-token`.

## Dev 등록

Register in dev through seed data, current API process state, or the Web/API catalog flow. Then check:

```sh
curl http://localhost:4000/api/servers
curl http://localhost:4000/api/servers/<serverId>/tools
curl http://localhost:5000/mcp/<serverSlug> -H 'authorization: Bearer dev-admin-token'
```

Confirm Web pages:

1. `/catalog`
2. `/servers/:serverId`
3. `/operations`
4. `/audit`
5. `/client-config`

## Stg Promotion

Promote the same reviewed manifest and image digest to staging. Validate Helm rendering before sync:

```sh
pnpm helm:template
```

Use [RELEASE.md](RELEASE.md) for digest promotion and schema diff review. The canary values are disabled placeholders and do not render traffic splitting resources.

## Prod Approval

Production approval should include:

1. Owner team approval.
2. Platform approval for high or critical tools.
3. Security manifest review.
4. Grant and approval review.
5. Rollback plan.
6. Monitoring and runbook confirmation.

## Monitoring 확인

After registration or promotion, check:

```sh
curl http://localhost:4000/healthz
curl http://localhost:4000/readyz
curl http://localhost:5000/metrics
curl 'http://localhost:4000/api/audit-events?limit=10'
```

Use `/operations` for health status, `/audit` for policy and admin events, and `/admin` for emergency controls.
