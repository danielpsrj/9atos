import { execSync } from 'node:child_process';

// Smoke-test global teardown (issue #50). Tears down the ephemeral Postgres
// (the db-test compose service) and wipes its anonymous volume, so the database
// is truly ephemeral — no state leaks between runs.
export default function globalTeardown(): void {
  console.log('── tearing down test database ──');
  execSync('docker compose --profile test down -v --remove-orphans', {
    stdio: 'inherit',
  });
}
