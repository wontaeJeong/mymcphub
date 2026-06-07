# Corporate CA certificates

Place internal corporate TLS trust anchors in this directory before building images.

- Use PEM-encoded files with a `.crt` extension, for example `corporate-root-ca.crt`.
- Do not commit real private or sensitive certificate material unless it is explicitly approved for repository distribution.
- Dockerfiles copy this directory into build and runtime images and run `update-ca-certificates` when one or more non-empty `.crt` files are present.
- Development and build-time proxy variables (`HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`, and lowercase variants) are accepted as Docker build args. Runtime images and Helm workloads intentionally do not set proxy environment variables by default.
