# Implementation Notes

- Durable PostgreSQL repositories are not wired yet; the Go core uses a local JSON runtime store (`MCP_STORE_PATH`, defaulting under the OS temp directory) so separately running API, Gateway, and Worker processes can share local state without changing the existing SQL schema.
- Runtime JWKS fetching is not implemented; OIDC mode fails closed without trusted identity headers and is intended for ingress/auth-proxy integration until signed JWT validation is wired.
- The Helm chart renders Go service images but does not define a Kubernetes Job for `mcphubctl`; CLI release artifacts are built in CI.
