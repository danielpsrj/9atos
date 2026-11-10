// First-run / onboarding screen (issue #35). Runs headless Chromium against the
// DEPLOYED app on Dockhand (baseURL in playwright.config.ts). Verifies the
// onboarding contract: with zero notebooks the onboarding screen (not an empty
// grid) is shown, both CTAs (import / use sample data) are present, the import
// CTA links to the Knowledge Base, the copy is localized in both locales, and
// "use sample data" creates a notebook and the onboarding screen disappears. No
// local server is started.
//
// Test order matters: the "use sample data" test creates a notebook and only
// cleans up in afterAll, so it runs LAST — every "onboarding is shown" test
// above it relies on the zero-notebook first-run state.
//
// The sample notebook created by the "use seed" test is deleted afterwards so
// the deployment is left tidy.

import { expect, test } from '@playwright/test';

// The sample notebook name created by POST /api/cadernos/from-seed (must match
// the route's SAMPLE_NAME).
const SAMPLE_NAME = 'Constituição Federal — Direitos Fundamentais';

test.describe('onboarding screen (first run)', () => {
  test('shows the onboarding screen with both CTAs (pt-BR)', async ({ page }) => {
    await page.goto('/pt-BR');
    await page.waitForLoadState('networkidle');

    // The onboarding title and description are visible.
    await expect(page.getByRole('heading', { name: 'Bem-vindo ao 9Atos' })).toBeVisible();
    await expect(page.getByText('repetição espaçada')).toBeVisible();

    // Both CTAs are present.
    await expect(page.getByRole('link', { name: 'Importar dados' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Usar dados de exemplo' })).toBeVisible();

    // The empty grid / "New Notebook" dialog are NOT shown on first run.
    await expect(page.getByRole('button', { name: 'Novo Caderno' })).toBeHidden();
  });

  test('onboarding copy is localized in en-US', async ({ page }) => {
    await page.goto('/en-US');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Welcome to 9Atos' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Import data' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Use sample data' })).toBeVisible();
  });

  test('import CTA links to the Knowledge Base', async ({ page }) => {
    await page.goto('/pt-BR');
    await page.waitForLoadState('networkidle');

    const importCta = page.getByRole('link', { name: 'Importar dados' });
    await expect(importCta).toBeVisible();
    // The import flow lands in Phase 8; the CTA is clearly linked to the
    // Knowledge Base where it will live.
    await expect(importCta).toHaveAttribute('href', /\/pt-BR\/knowledge/);
  });

  test('use sample data creates a notebook and the onboarding screen disappears', async ({
    page,
  }) => {
    await page.goto('/pt-BR');
    await page.waitForLoadState('networkidle');

    // Onboarding is shown before the action.
    await expect(page.getByRole('heading', { name: 'Bem-vindo ao 9Atos' })).toBeVisible();

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/cadernos/from-seed')),
      page.getByRole('button', { name: 'Usar dados de exemplo' }).click(),
    ]);
    expect(response.status()).toBe(201);

    // After the action, router.refresh() re-runs the server component: the
    // onboarding screen disappears and the notebook grid shows the new card.
    await expect(page.getByRole('heading', { name: 'Bem-vindo ao 9Atos' })).toBeHidden();
    await expect(page.getByText(SAMPLE_NAME)).toBeVisible();
  });
});

// Clean up the sample notebook created by the "use seed" test so the deployment
// is left tidy (back to the first-run state).
test.afterAll(async ({ request }) => {
  const list = await request.get('/api/cadernos');
  if (!list.ok()) return;
  const cadernos = (await list.json()) as { id: string; nome: string }[];
  for (const c of cadernos) {
    if (c.nome === SAMPLE_NAME) {
      await request.delete(`/api/cadernos/${c.id}`);
    }
  }
});
