#!/usr/bin/env bash
# Orchestrates repository/API unit tests against a real ephemeral Postgres 16
# (plan §6). Starts the db-test service (test profile), applies migrations,
# runs Vitest, then tears the container down. No mocked Prisma client.
set -euo pipefail

TEST_DB_URL="postgresql://postgres:secret@127.0.0.1:5433/9atos_test"
export DATABASE_URL="$TEST_DB_URL"

cleanup() {
  echo "── tearing down test database ──"
  docker compose --profile test down -v --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "── starting ephemeral test database (db-test) ──"
docker compose --profile test up -d db-test

echo "── waiting for postgres readiness ──"
for _ in $(seq 1 30); do
  if docker compose --profile test exec -T db-test pg_isready -U postgres -d 9atos_test >/dev/null 2>&1; then
    echo "postgres ready"
    break
  fi
  sleep 1
done

echo "── applying migrations to test database ──"
npx prisma migrate deploy

echo "── running unit tests ──"
npx vitest run "$@"
