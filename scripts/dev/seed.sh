#!/usr/bin/env sh
set -eu

echo "Go core seed data is built into internal/db.NewSeedStore for local development."
echo "Shared test/Web fixture mirror: tests/fixtures/local-seed.json"
echo "This helper does not directly mutate PostgreSQL, Kubernetes, or secrets."
