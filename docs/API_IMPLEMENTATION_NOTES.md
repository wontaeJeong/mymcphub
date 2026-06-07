# API Implementation Notes

- The Go API preserves the previous response shapes used by the Web UI while using the local runtime store for catalog, audit, and quota state.
- Durable PostgreSQL repositories are the next implementation step once DB access contracts are finalized.
- Runtime Gateway OIDC/JWKS verification is implemented for bearer JWTs. The Control Plane API still supports trusted-header integration for ingress/auth-proxy deployments, but only when `MCP_TRUSTED_AUTH_HEADERS=true`; otherwise OIDC mode requires a bearer JWT or returns an anonymous context.
