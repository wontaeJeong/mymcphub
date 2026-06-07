# 75 RELEASE_NOTES_CHANGELOG_GENERATOR_GO Handoff

## Changed Files

- `scripts/release/generate-notes.sh`
- `package.json`
- `Makefile`
- `scripts/README.md`
- `docs/RELEASE.md`

## Contract/Schema Changes

- None.

## DB Migration 여부

- No migration added.

## Test Results

- `bash -n scripts/release/generate-notes.sh` passed.
- Manual tmux QA passed for `pnpm release:notes -- --version 0.1.0 --revision manual-qa --image-digest api=sha256:...` rendering Markdown with version, digest, CLI artifacts, schema changes, and validation checklist.

## Remaining TODO

- None.

## Conflict Risks

- Release docs may conflict with supply-chain release automation from Lane F.
