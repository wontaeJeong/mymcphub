# Documentation Index

Use this index to find the smallest document set needed for the current work.

## MVP 필수

| Doc                               | Use                                                                       |
| --------------------------------- | ------------------------------------------------------------------------- |
| [MVP Demo](MVP_DEMO.md)           | End-to-end demo order, expected screens, fallback steps, and demo checks. |
| [Local Development](LOCAL_DEV.md) | Local stack startup, seed data, mock tokens, and reset flow.              |
| [Testing](TESTING.md)             | Main validation commands and focused test suites.                         |
| [Contracts](CONTRACTS.md)         | OpenAPI, JSON Schema, generated Web boundary, and generation checks.      |

## 개발

| Doc                                             | Use                                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------- |
| [Architecture](ARCHITECTURE.md)                 | Runtime planes, Go services, Web UI, schemas, and deployment shape. |
| [Developer Guide](DEVELOPER_GUIDE.md)           | Go conventions, fixtures, and validation surfaces.                  |
| [Control Plane API](API.md)                     | API routes and local curl checks.                                   |
| [Gateway](GATEWAY.md)                           | Gateway auth, policy, redaction, and proxy behavior.                |
| [Worker](WORKER.md)                             | Worker jobs and manual trigger endpoint.                            |
| [CLI](CLI.md)                                   | `mcphubctl` command guide.                                          |
| [Web Auth Route Split](WEB_AUTH_ROUTE_SPLIT.md) | Browser auth, user/admin route split, and provider configuration.   |

## 운영

| Doc                                           | Use                                                                     |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| [Operations](OPERATIONS.md)                   | Day-2 operating model.                                                  |
| [Runbooks](RUNBOOKS.md)                       | Gateway, upstream, auth, policy, schema drift, and quarantine response. |
| [Audit Observability](AUDIT_OBSERVABILITY.md) | Audit, metrics, and observability notes.                                |
| [Policy](POLICY.md)                           | Authorization policy model.                                             |

## 배포/보안

| Doc                         | Use                                    |
| --------------------------- | -------------------------------------- |
| [Deployment](DEPLOYMENT.md) | Helm and GitOps deployment.            |
| [Rollback](ROLLBACK.md)     | Roll back to previous Go image tags.   |
| [Security](SECURITY.md)     | Security model and scan expectations.  |
| [CI](CI.md)                 | CI jobs and local equivalent commands. |
| [Release](RELEASE.md)       | Release process notes.                 |

## 참고

| Doc                                                     | Use                                               |
| ------------------------------------------------------- | ------------------------------------------------- |
| [Client Setup](CLIENT_SETUP.md)                         | MCP client setup notes.                           |
| [MCP Client Compatibility](MCP_CLIENT_COMPATIBILITY.md) | Client profile support matrix.                    |
| [MCP Server Matrix](MCP_SERVER_LANGUAGE_MATRIX.md)      | First-party server language decisions.            |
| [MCP Server Onboarding](MCP_SERVER_ONBOARDING.md)       | Server onboarding notes.                          |
| [Scripts To CLI Migration](SCRIPTS_TO_CLI_MIGRATION.md) | Migration away from operational scripts.          |
| [Worktree Merge Guide](WORKTREE_MERGE_GUIDE.md)         | Parallel lane merge order and conflict checklist. |
