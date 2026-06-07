# 63. SBOM_IMAGE_SIGNING_GO_CORE Handoff

## Changed Files

- `.github/workflows/ci.yaml`
- `scripts/security/sbom-sign-images.sh`
- `scripts/security/check-all.sh`
- `scripts/security/README.md`
- `docs/RELEASE.md`
- `docs/CI.md`
- `docs/SECURITY.md`
- Go core and Web Dockerfiles updated to patched Go builder images where applicable.

## Contract/Schema Changes

- None.

## DB Migration

- None.

## Tests And Verification

- `SECURITY_IMAGES='' scripts/security/sbom-sign-images.sh`
- Go/Web image build references wired in `.github/workflows/ci.yaml`.

## Remaining TODO

- Real signing and attestation require `SECURITY_SIGN_IMAGES=1`, `SECURITY_ATTEST_SBOM=1`, and registry/cosign credentials.
- Dockerfile base image digest pinning still needs approved base image digests; `scan-images.sh` reports unpinned base images as non-strict review items.

## Conflict Notes

- Helm already supports digest promotion; no chart contract change was required.
- Web runtime image was hardened with a non-root user.
