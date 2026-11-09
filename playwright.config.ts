import { defineConfig } from '@playwright/test';

// E2E / accessibility tests (issue #31). These run a headless Chromium against
// the DEPLOYED app on Dockhand (host port 3005) — they do not start a local
// server, honoring the "verify on Dockhand, never run the app locally" rule.
// Override the target with E2E_BASE_URL if the deployment moves.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://192.168.1.207:3005',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
