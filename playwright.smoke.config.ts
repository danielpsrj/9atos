import { defineConfig } from '@playwright/test';

// Smoke-test config (issue #50, FR-04/05/06/12). Unlike the main e2e config
// (which targets the Dockhand deployment), this runs the FULL user loop against
// a real ephemeral database + a locally-built app, so it passes in CI. The
// global-setup spins up the ephemeral Postgres, migrates, seeds, and backdates
// the bootstrap user's ultimoAcesso (so the streak-increment assertion is
// meaningful); the webServer builds and starts the app against that database;
// the global-teardown wipes the database. Chromium only (plan §2.4).
const TEST_DB_URL = 'postgresql://postgres:secret@127.0.0.1:5433/9atos_test';
const APP_URL = 'http://localhost:3000';

export default defineConfig({
  testDir: './tests/smoke',
  timeout: 60_000,
  globalSetup: './tests/smoke/global-setup.ts',
  globalTeardown: './tests/smoke/global-teardown.ts',
  use: {
    baseURL: APP_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npm run build && npm run start',
    url: `${APP_URL}/api/health`,
    timeout: 180_000,
    env: { DATABASE_URL: TEST_DB_URL },
    reuseExistingServer: false,
  },
});
