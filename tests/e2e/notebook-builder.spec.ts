// Notebook builder (issue #47, FR-03). Runs headless Chromium against the
// DEPLOYED app on Dockhand (baseURL in playwright.config.ts). Verifies that
// rules can be selected in the knowledge tree and added to a notebook, that the
// selection survives navigating away and back (persisted via localStorage),
// that rules already in the notebook are marked and not double-added, and that
// added rules appear in the notebook immediately. A notebook is created via the
// API at the start and cleaned up afterwards so the deployment is left tidy.
// No local server is started.

import { expect, test, type Page, type APIRequestContext } from '@playwright/test';

// The seeded regra to select (a stable, known rule, id regra-01). It lives
// under the Topico "Princípios Básicos (Art. 1º)". The full pergunta includes
// the "segundo o Art. 1º, caput?" suffix — the checkbox's aria-label is the
// full pergunta, so the constant must match it exactly.
const SEEDED_REGRA =
  'Quais são os fundamentos da República Federativa do Brasil segundo o Art. 1º, caput?';

// The seeded hierarchy path to SEEDED_REGRA (Area → Disciplina → Topico).
const AREA_NAME = 'Direito Constitucional';
const DISCIPLINA_NAME = 'Direitos e Garantias Fundamentais';
const TOPICO_NAME = 'Princípios Básicos (Art. 1º)';

// Delete any leftover test notebooks from a previous failed run (they carry the
// "Teste E2E" marker). Keeps the deployment tidy and ensures the builder's
// target-notebook selector defaults to the notebook this run creates.
async function cleanupLeftoverTestNotebooks(request: APIRequestContext): Promise<void> {
  const res = await request.get('/api/cadernos');
  if (!res.ok()) return;
  const cadernos = (await res.json()) as { id: string; nome: string }[];
  for (const caderno of cadernos) {
    if (caderno.nome.includes('Teste E2E')) {
      await request.delete(`/api/cadernos/${caderno.id}`);
    }
  }
}

// Expand a tree node by its visible name. The node row is the `div.group`
// whose name span directly contains the text; the "Expandir" button is inside
// that row. Expanding by name (rather than by index) is robust to the tree's
// shape — once a node is expanded its button becomes "Recolher", so a flat
// index over all "Expandir" buttons does not track the hierarchy.
async function expandNode(page: Page, name: string): Promise<void> {
  await page
    .locator('div.group')
    .filter({ has: page.locator('span.min-w-0').filter({ hasText: name }) })
    .getByRole('button', { name: 'Expandir' })
    .click();
}

// Expand the full path to the seeded regra's topico.
async function expandToSeededRegra(page: Page): Promise<void> {
  await expandNode(page, AREA_NAME);
  await expandNode(page, DISCIPLINA_NAME);
  await expandNode(page, TOPICO_NAME);
}

test.describe('notebook builder (#47)', () => {
  test('select rules in the tree and add them to a notebook', async ({ page, request }) => {
    // Clean up any leftover test notebooks from a previous failed run.
    await cleanupLeftoverTestNotebooks(request);

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
    await expandToSeededRegra(page);

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
    // Clean up any leftover test notebooks from a previous failed run.
    await cleanupLeftoverTestNotebooks(request);

    // Create a notebook via the API.
    const createRes = await request.post('/api/cadernos', {
      data: { nome: 'Caderno de Teste E2E Persist' },
    });
    const caderno = (await createRes.json()) as { id: string };

    await page.goto('/pt-BR/notebooks');
    await page.waitForLoadState('networkidle');

    // Expand the tree and select a regra.
    await expandToSeededRegra(page);
    const checkbox = page.getByRole('checkbox', { name: SEEDED_REGRA });
    await checkbox.check();
    await expect(page.getByText('1 regra(s) selecionada(s)')).toBeVisible();

    // Navigate away (to the dashboard) and back.
    await page.goto('/pt-BR/');
    await page.waitForLoadState('networkidle');
    await page.goto('/pt-BR/notebooks');
    await page.waitForLoadState('networkidle');

    // The selection is restored: the checkbox is still checked and the count
    // is still 1. (The tree re-collapses on navigation, so re-expand to the
    // regra before asserting on its checkbox.)
    await expandToSeededRegra(page);
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
    // Clean up any leftover test notebooks from a previous failed run.
    await cleanupLeftoverTestNotebooks(request);

    // Create a notebook and add the seeded regra (id regra-01) to it via the
    // API, so it's already present when the builder loads.
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
    await expandToSeededRegra(page);

    // The rule is marked as already in the notebook (not a checkbox).
    await expect(page.getByText('Já está no caderno')).toBeVisible();
    // There is no checkbox for it (it's not selectable).
    await expect(page.getByRole('checkbox', { name: SEEDED_REGRA })).toBeHidden();

    // Clean up the notebook.
    await request.delete(`/api/cadernos/${caderno.id}`);
  });
});
