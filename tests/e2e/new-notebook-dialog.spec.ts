// New-notebook dialog flow (issue #34). Runs headless Chromium against the
// DEPLOYED app on Dockhand (baseURL in playwright.config.ts). Verifies the full
// dialog contract: the trigger opens the dialog, an empty/whitespace name is
// blocked client-side with the localized error, a valid name POSTs to
// /api/cadernos and the new notebook appears in the grid (router.refresh),
// Escape closes the dialog, and focus is trapped inside it. No local server is
// started. The notebook created by the "create" test is deleted afterwards so
// the deployment is left tidy.

import { expect, test } from '@playwright/test';

// A unique name so the test never collides with an existing notebook.
const uniqueName = 'E2E Dialog ' + String(Date.now());

test.describe('new-notebook dialog', () => {
  test('trigger opens the dialog with labeled inputs', async ({ page }) => {
    await page.goto('/pt-BR');
    await page.waitForLoadState('networkidle');

    // The trigger button is the "Novo Caderno" button in the section header.
    const trigger = page.getByRole('button', { name: 'Novo Caderno' });
    await expect(trigger).toBeVisible();
    await trigger.click();

    // The dialog content is rendered in a portal once open.
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Novo Caderno' })).toBeVisible();

    // Both inputs are present and labeled (accessible names resolve).
    await expect(page.getByLabel('Nome')).toBeVisible();
    await expect(page.getByLabel('Descrição')).toBeVisible();
  });

  test('empty and whitespace names are blocked client-side', async ({ page }) => {
    await page.goto('/pt-BR');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Novo Caderno' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Submit with an empty name: blocked, no request, localized error shown.
    await dialog.getByRole('button', { name: 'Criar' }).click();
    await expect(page.getByRole('alert')).toHaveText('O nome é obrigatório.');

    // A whitespace-only name is also blocked.
    await page.getByLabel('Nome').fill('   ');
    await dialog.getByRole('button', { name: 'Criar' }).click();
    await expect(page.getByRole('alert')).toHaveText('O nome é obrigatório.');

    // The dialog stays open (not dismissed by a failed submit).
    await expect(dialog).toBeVisible();
  });

  test('a valid name creates a notebook that appears in the grid', async ({ page }) => {
    await page.goto('/pt-BR');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Novo Caderno' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await page.getByLabel('Nome').fill(uniqueName);
    await page.getByLabel('Descrição').fill('created by the dialog e2e');

    // The create button POSTs to /api/cadernos.
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/cadernos')),
      dialog.getByRole('button', { name: 'Criar' }).click(),
    ]);
    expect(response.status()).toBe(201);

    // On success the dialog closes and router.refresh() re-runs the server
    // component, so the new notebook appears in the grid.
    await expect(dialog).toBeHidden();
    await expect(page.getByText(uniqueName)).toBeVisible();
  });

  test('Escape closes the dialog', async ({ page }) => {
    await page.goto('/pt-BR');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Novo Caderno' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('focus is trapped inside the open dialog', async ({ page }) => {
    await page.goto('/pt-BR');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Novo Caderno' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Move focus to the name field, then Tab through the dialog's controls.
    // Radix traps focus: Tab from the last control wraps back to the first
    // focusable element inside the dialog rather than escaping to the page.
    await page.getByLabel('Nome').focus();
    await page.keyboard.press('Tab'); // -> Descrição
    await expect(page.getByLabel('Descrição')).toBeFocused();
    await page.keyboard.press('Tab'); // -> Criar
    await expect(dialog.getByRole('button', { name: 'Criar' })).toBeFocused();
    await page.keyboard.press('Tab'); // wraps back to the first control
    // The wrapped focus must still be inside the dialog (not the page body).
    const insideDialog = await dialog.evaluate((d) => d.contains(document.activeElement));
    expect(insideDialog).toBe(true);
  });
});

// Clean up the notebook created by the "create" test so the deployment is left
// tidy. Runs after the describe block.
test.afterAll(async ({ request }) => {
  const list = await request.get('/api/cadernos');
  if (!list.ok()) return;
  const cadernos = (await list.json()) as { id: string; nome: string }[];
  for (const c of cadernos) {
    if (c.nome === uniqueName) {
      await request.delete(`/api/cadernos/${c.id}`);
    }
  }
});
