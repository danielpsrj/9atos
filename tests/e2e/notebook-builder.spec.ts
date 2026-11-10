// Notebook builder (issue #47, FR-03). Runs headless Chromium against the
// DEPLOYED app on Dockhand (baseURL in playwright.config.ts). Verifies that
// rules can be selected in the knowledge tree and added to a notebook, that the
// selection survives navigating away and back (persisted via localStorage),
// that rules already in the notebook are marked and not double-added, and that
// added rules appear in the notebook immediately. A notebook is created via the
// API at the start and cleaned up afterwards so the deployment is left tidy.
// No local server is started.

import { expect, test } from '@playwright/test';

// The first seeded topico's first regra (a stable, known rule to select).
const SEEDED_REGRA = 'Quais são os fundamentos da República Federativa do Brasil';

test.describe('notebook builder (#47)', () => {
  test('select rules in the tree and add them to a notebook', async ({ page, request }) => {
    // Create a notebook via the API (the deployment starts with none).
    const createRes = await request.post('/api/cadernos', {
      data: { nome: 'Caderno de Teste E2E' },
    });
    expect(createRes.ok()).toBeTruthy();
    const caderno = (await createRes.json()) as { id: string };

    await page.goto('/pt-BR/notebooks');
    await page.waitForLoadState('networkidle');

    // The target notebook selector is pre-populated with the created notebook.
    const select = page.getByLabel('Caderno de destino');
    await expect(select).toBeVisible();
    await expect(select).toHaveValue(caderno.id);

    // Expand the tree to the seeded regra.
    await page.getByRole('button', { name: 'Expandir' }).first().click(); // area
    await page.getByRole('button', { name: 'Expandir' }).nth(1).click(); // disciplina
    await page.getByRole('button', { name: 'Expandir' }).nth(2).click(); // topico

    // Select the seeded regra (its checkbox).
    const checkbox = page.getByRole('checkbox', { name: SEEDED_REGRA });
    await expect(checkbox).toBeVisible();
    await checkbox.check();

    // The selection count updates.
    await expect(page.getByText('1 regra(s) selecionada(s)')).toBeVisible();

    // Add the selected rule to the notebook.
    await page.getByRole('button', { name: 'Adicionar ao caderno' }).click();
    await expect(page.getByText('1 regra(s) adicionada(s) ao caderno.')).toBeVisible();

    // Verify the rule is in the notebook (round-trip).
    const notebookRes = await request.get(`/api/cadernos/${caderno.id}`);
    const notebook = (await notebookRes.json()) as {
      regras: { regra: { pergunta: string } }[];
    };
    expect(
      notebook.regras.some((r) => r.regra.pergunta === SEEDED_REGRA),
      'the added rule should be in the notebook',
    ).toBeTruthy();

    // The rule is now marked as already in the notebook (not a checkbox).
    await expect(page.getByText('Já está no caderno')).toBeVisible();

    // Clean up the notebook.
    await request.delete(`/api/cadernos/${caderno.id}`);
  });

  test('selection survives navigating away and back', async ({ page, request }) => {
    // Create a notebook via the API.
    const createRes = await request.post('/api/cadernos', {
      data: { nome: 'Caderno de Teste E2E Persist' },
    });
    const caderno = (await createRes.json()) as { id: string };

    await page.goto('/pt-BR/notebooks');
    await page.waitForLoadState('networkidle');

    // Expand the tree and select a regra.
    await page.getByRole('button', { name: 'Expandir' }).first().click();
    await page.getByRole('button', { name: 'Expandir' }).nth(1).click();
    await page.getByRole('button', { name: 'Expandir' }).nth(2).click();
    const checkbox = page.getByRole('checkbox', { name: SEEDED_REGRA });
    await checkbox.check();
    await expect(page.getByText('1 regra(s) selecionada(s)')).toBeVisible();

    // Navigate away (to the dashboard) and back.
    await page.goto('/pt-BR/');
    await page.waitForLoadState('networkidle');
    await page.goto('/pt-BR/notebooks');
    await page.waitForLoadState('networkidle');

    // The selection is restored: the checkbox is still checked and the count
    // is still 1.
    await expect(page.getByRole('checkbox', { name: SEEDED_REGRA })).toBeChecked();
    await expect(page.getByText('1 regra(s) selecionada(s)')).toBeVisible();

    // Clean up: clear the selection and delete the notebook.
    await page.getByRole('checkbox', { name: SEEDED_REGRA }).uncheck();
    await request.delete(`/api/cadernos/${caderno.id}`);
  });

  test('rules already in the notebook are marked and not double-added', async ({
    page,
    request,
  }) => {
    // Create a notebook and add a rule to it via the API (so it's already
    // present when the builder loads).
    const createRes = await request.post('/api/cadernos', {
      data: { nome: 'Caderno de Teste E2E Dup' },
    });
    const caderno = (await createRes.json()) as { id: string };
    await request.post(`/api/cadernos/${caderno.id}/regras`, {
      data: { regraId: 'regra-01' },
    });

    await page.goto('/pt-BR/notebooks');
    await page.waitForLoadState('networkidle');

    // Expand the tree to the rule that's already in the notebook.
    await page.getByRole('button', { name: 'Expandir' }).first().click();
    await page.getByRole('button', { name: 'Expandir' }).nth(1).click();
    await page.getByRole('button', { name: 'Expandir' }).nth(2).click();

    // The rule is marked as already in the notebook (not a checkbox).
    await expect(page.getByText('Já está no caderno')).toBeVisible();
    // There is no checkbox for it (it's not selectable).
    await expect(page.getByRole('checkbox', { name: SEEDED_REGRA })).toBeHidden();

    // Clean up the notebook.
    await request.delete(`/api/cadernos/${caderno.id}`);
  });
});
