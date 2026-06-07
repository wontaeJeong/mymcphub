# API Implementation Notes

- The Go API preserves the previous local in-memory behavior and response shapes used by the Web UI.
- Durable PostgreSQL repositories are the next implementation step once DB access contracts are finalized.
- Runtime OIDC/JWKS verification is represented by trusted header mode for local/shared-ingress integration; full JWKS retrieval is not implemented here.
