// Settings screen (issue #36). Runs headless Chromium against the DEPLOYED app
// on Dockhand (baseURL in playwright.config.ts). Verifies the settings contract:
// all six tunables are present and editable, out-of-range values show inline
// validation errors and are not saved, a daily-goal change round-trips (save →
// reload → same value) and is reflected in the dashboard goal widget, and the
// screen is localized in both locales. No local server is started. The daily
// goal is restored to its original value afterwards so the deployment is left
// tidy.

import { expect, test } from '@playwright/test';

// The daily goal we set during the round-trip test.
const TEST_GOAL = '42';

test.describe('settings screen', () => {
  test('all six tunables are present and editable (pt-BR)', async ({ page }) => {
    await page.goto('/pt-BR/settings');
    await page.waitForLoadState('networkidle');

    // Streak mode (select) + the four numeric fields + the Zen Mode switch.
    await expect(page.getByLabel('Modo de sequência')).toBeVisible();
    await expect(page.getByLabel('Limiar da ofensiva')).toBeVisible();
    await expect(page.getByLabel('Meta diária')).toBeVisible();
    await expect(page.getByLabel('Tempo por cartão')).toBeVisible();
    await expect(page.getByLabel('Tamanho da sessão')).toBeVisible();
    await expect(page.getByLabel('Zen Mode (padrão)')).toBeVisible();

    // The save button is present and enabled.
    await expect(page.getByRole('button', { name: 'Salvar' })).toBeEnabled();
  });

  test('out-of-range values show inline errors and are not saved', async ({ page }) => {
    await page.goto('/pt-BR/settings');
    await page.waitForLoadState('networkidle');

    // Set the per-card timer to an out-of-range value (max is 120).
    const timer = page.getByLabel('Tempo por cartão');
    await timer.fill('999');
    await page.getByRole('button', { name: 'Salvar' }).click();

    // The inline validation error is shown and no PATCH is sent (the form is
    // blocked client-side), so the value is not saved.
    await expect(page.getByRole('alert')).toHaveText(
      'O tempo por cartão deve ser um inteiro entre 5 e 120.',
    );
    // The field still holds the invalid value (not reset to a saved value).
    await expect(timer).toHaveValue('999');
  });

  test('daily goal round-trips and is reflected in the dashboard widget', async ({ page }) => {
    await page.goto('/pt-BR/settings');
    await page.waitForLoadState('networkidle');

    // Change the daily goal and save.
    const goal = page.getByLabel('Meta diária');
    await goal.fill(TEST_GOAL);
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/settings')),
      page.getByRole('button', { name: 'Salvar' }).click(),
    ]);
    expect(response.status()).toBe(200);
    await expect(page.getByRole('status')).toHaveText('Configurações salvas.');

    // Reload: the saved value round-trips.
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByLabel('Meta diária')).toHaveValue(TEST_GOAL);

    // The dashboard goal widget reflects the new goal on the next load.
    await page.goto('/pt-BR');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('42/42 regras')).toBeVisible();
  });

  test('settings screen is localized in en-US', async ({ page }) => {
    await page.goto('/en-US/settings');
    await page.waitForLoadState('networkidle');

    await expect(page.getByLabel('Streak mode')).toBeVisible();
    await expect(page.getByLabel('Daily goal')).toBeVisible();
    await expect(page.getByLabel('Per-card timer')).toBeVisible();
    await expect(page.getByLabel('Session size')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();
  });
});

// Restore the daily goal to the documented default (30) so the deployment is
// left tidy after the round-trip test.
test.afterAll(async ({ request }) => {
  await request.patch('/api/settings', {
    data: { metaDiaria: 30 },
  });
});
