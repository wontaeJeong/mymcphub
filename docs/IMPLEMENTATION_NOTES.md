# Implementation Notes

- Durable PostgreSQL repositories are not wired yet; the Go core uses a local JSON runtime store (`MCP_STORE_PATH`, defaulting under the OS temp directory) so separately running API, Gateway, and Worker processes can share local state without changing the existing SQL schema.
- Gateway OIDC resource-server validation is wired for bearer JWTs with issuer, audience, expiry, scope, HS256 local-test signatures, and RS256 JWKS cache. The API still uses mock auth by default for local development; trusted identity headers are honored only when `MCP_TRUSTED_AUTH_HEADERS=true`.
- The Helm chart renders Go service images but does not define a Kubernetes Job for `mcphubctl`; CLI release artifacts are built in CI.
