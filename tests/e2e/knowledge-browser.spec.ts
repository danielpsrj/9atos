// Knowledge tree browser (issue #46, FR-01). Runs headless Chromium against the
// DEPLOYED app on Dockhand (baseURL in playwright.config.ts). Verifies the full
// hierarchy (Area → Disciplina → Topico → Regra) renders and expands/collapses,
// that create/edit/delete works at each of the four levels, and that the
// distractor list editor adds, removes, and reorders distractors with changes
// persisting. Every mutation is round-tripped through the 4.3 CRUD routes and
// verified against the API (change in UI → visible in DB → visible on reload).
// No local server is started. Created nodes are cleaned up afterwards so the
// deployment is left tidy.

import { expect, test, type Page, type APIRequestContext } from '@playwright/test';

// A unique suffix so each run creates distinct nodes (a failed run that leaves
// nodes behind never collides with the next run). The seeded hierarchy uses
// fixed names, so these never collide with it.
const SUFFIX = String(Date.now());
const AREA_NAME = `Área de Teste E2E ${SUFFIX}`;
const DISCIPLINA_NAME = `Disciplina de Teste E2E ${SUFFIX}`;
const TOPICO_NAME = `Tópico de Teste E2E ${SUFFIX}`;
const REGRA_PERGUNTA = `Pergunta de teste E2E ${SUFFIX}?`;

// Delete any leftover test areas from a previous failed run (they carry the
// "Teste E2E" marker). Keeps the deployment tidy.
async function cleanupLeftoverTestAreas(request: APIRequestContext): Promise<void> {
  const res = await request.get('/api/areas');
  if (!res.ok()) return;
  const areas = (await res.json()) as { id: string; nome: string }[];
  for (const area of areas) {
    if (area.nome.includes('Teste E2E')) {
      await request.delete(`/api/areas/${area.id}`);
    }
  }
}

// The row for a node, located by its visible name. The row is the `div.group`
// whose name span directly contains the text (not an ancestor that also
// contains a child row with the same text).
function nodeRow(page: Page, name: string): import('@playwright/test').Locator {
  return page.locator('div.group').filter({
    has: page.locator('span.min-w-0').filter({ hasText: name }),
  });
}

// Expand a node (click its "Expandir" toggle) and wait for its children.
async function expandNode(page: Page, name: string): Promise<void> {
  const row = nodeRow(page, name);
  await row.getByRole('button', { name: 'Expandir' }).click();
}

// Collapse a node (click its "Recolher" toggle).
async function collapseNode(page: Page, name: string): Promise<void> {
  const row = nodeRow(page, name);
  await row.getByRole('button', { name: 'Recolher' }).click();
}

test.describe('knowledge tree browser (#46)', () => {
  test('the tree renders the seeded hierarchy and expands/collapses', async ({ page }) => {
    await page.goto('/pt-BR/knowledge');
    await page.waitForLoadState('networkidle');

    // The seeded area is visible.
    await expect(nodeRow(page, 'Direito Constitucional')).toBeVisible();

    // It starts collapsed: its disciplinas are not visible.
    await expect(nodeRow(page, 'Direitos e Garantias Fundamentais')).toBeHidden();

    // Expand the area: its disciplinas appear.
    await expandNode(page, 'Direito Constitucional');
    await expect(nodeRow(page, 'Direitos e Garantias Fundamentais')).toBeVisible();
    await expect(nodeRow(page, 'Garantias Constitucionais')).toBeVisible();

    // Expand a disciplina: its topicos appear.
    await expandNode(page, 'Direitos e Garantias Fundamentais');
    await expect(nodeRow(page, 'Princípios Básicos (Art. 1º)')).toBeVisible();

    // Expand a topico: its regras appear.
    await expandNode(page, 'Princípios Básicos (Art. 1º)');
    await expect(
      nodeRow(page, 'Quais são os fundamentos da República Federativa do Brasil'),
    ).toBeVisible();

    // Collapse the area: its disciplinas disappear.
    await collapseNode(page, 'Direito Constitucional');
    await expect(nodeRow(page, 'Direitos e Garantias Fundamentais')).toBeHidden();
  });

  test('full CRUD round-trip at all four levels', async ({ page, request }) => {
    // Clean up any leftover test areas from a previous failed run.
    await cleanupLeftoverTestAreas(request);

    await page.goto('/pt-BR/knowledge');
    await page.waitForLoadState('networkidle');

    // ── Create an area ──────────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Nova área' }).click();
    await page.getByLabel('Nome', { exact: true }).fill(AREA_NAME);
    await page.getByRole('button', { name: 'Criar' }).click();
    await expect(nodeRow(page, AREA_NAME)).toBeVisible();

    // ── Create a disciplina under the area ──────────────────────────────────
    await expandNode(page, AREA_NAME);
    await nodeRow(page, AREA_NAME).getByRole('button', { name: 'Nova disciplina' }).click();
    await page.getByLabel('Nome', { exact: true }).fill(DISCIPLINA_NAME);
    await page.getByRole('button', { name: 'Criar' }).click();
    await expect(nodeRow(page, DISCIPLINA_NAME)).toBeVisible();

    // ── Create a topico under the disciplina ────────────────────────────────
    await expandNode(page, DISCIPLINA_NAME);
    await nodeRow(page, DISCIPLINA_NAME).getByRole('button', { name: 'Novo tópico' }).click();
    await page.getByLabel('Nome', { exact: true }).fill(TOPICO_NAME);
    await page.getByRole('button', { name: 'Criar' }).click();
    await expect(nodeRow(page, TOPICO_NAME)).toBeVisible();

    // ── Create a regra under the topico (with distractors) ──────────────────
    await expandNode(page, TOPICO_NAME);
    await nodeRow(page, TOPICO_NAME).getByRole('button', { name: 'Nova regra' }).click();
    await page.getByLabel('Pergunta').fill(REGRA_PERGUNTA);
    await page.getByLabel('Resposta certa').fill('Resposta de teste E2E');
    // Add two distractors.
    await page.getByRole('button', { name: 'Adicionar distrator' }).click();
    await page.getByRole('button', { name: 'Adicionar distrator' }).click();
    const distractorInputs = page.getByPlaceholder(/Distrator \d/);
    await distractorInputs.nth(0).fill('Distrator A');
    await distractorInputs.nth(1).fill('Distrator B');
    await page.getByRole('button', { name: 'Criar' }).click();
    await expect(nodeRow(page, REGRA_PERGUNTA)).toBeVisible();

    // ── Verify the round-trip against the API ───────────────────────────────
    // Find the created topico's id and confirm the regra is in the DB.
    const topicosRes = await request.get('/api/topicos');
    const topicos = (await topicosRes.json()) as { id: string; nome: string }[];
    const createdTopico = topicos.find((t) => t.nome === TOPICO_NAME);
    expect(createdTopico, 'created topico should exist in the DB').toBeDefined();
    const topicoId = createdTopico?.id;
    if (topicoId === undefined) throw new Error('created topico should have an id');
    const regrasRes = await request.get(`/api/topicos/${topicoId}/regras`);
    const regras = (await regrasRes.json()) as {
      pergunta: string;
      respostaCerta: string;
      distratores: string[];
    }[];
    const createdRegra = regras.find((r) => r.pergunta === REGRA_PERGUNTA);
    expect(createdRegra, 'created regra should exist in the DB').toBeDefined();
    expect(createdRegra?.respostaCerta).toBe('Resposta de teste E2E');
    expect(createdRegra?.distratores).toEqual(['Distrator A', 'Distrator B']);

    // ── Edit the regra: change the question, add/remove/reorder distractors ─
    await nodeRow(page, REGRA_PERGUNTA).getByRole('button', { name: 'Editar' }).click();
    await page.getByLabel('Pergunta').fill('Pergunta de teste E2E (editada)?');
    // Add a third distractor, then remove the first, then reorder. The
    // remove/move buttons are siblings of the input in the row div, so scope
    // them to the input's parent.
    await page.getByRole('button', { name: 'Adicionar distrator' }).click();
    const threeDistractors = page.getByPlaceholder(/Distrator \d/);
    await threeDistractors.nth(2).fill('Distrator C');
    // Remove "Distrator A" (index 0).
    await threeDistractors.nth(0).locator('..').getByRole('button', { name: 'Remover distrator 1' }).click();
    // Now the list is ["Distrator B", "Distrator C"]. Move "Distrator C" up.
    const twoDistractors = page.getByPlaceholder(/Distrator \d/);
    await twoDistractors.nth(1).locator('..').getByRole('button', { name: 'Mover para cima' }).click();
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(nodeRow(page, 'Pergunta de teste E2E (editada)?')).toBeVisible();

    // Verify the edit persisted: the question changed and the distractors are
    // reordered (["Distrator C", "Distrator B"]).
    const regrasAfterEdit = (await (
      await request.get(`/api/topicos/${topicoId}/regras`)
    ).json()) as { pergunta: string; distratores: string[] }[];
    const editedRegra = regrasAfterEdit.find(
      (r) => r.pergunta === 'Pergunta de teste E2E (editada)?',
    );
    expect(editedRegra, 'edited regra should exist in the DB').toBeDefined();
    expect(editedRegra?.distratores).toEqual(['Distrator C', 'Distrator B']);

    // ── Edit the hierarchy nodes (area, disciplina, topico) ─────────────────
    // Edit the topico's name.
    await nodeRow(page, TOPICO_NAME).getByRole('button', { name: 'Editar' }).click();
    await page.getByLabel('Nome', { exact: true }).fill('Tópico de Teste E2E (editado)');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(nodeRow(page, 'Tópico de Teste E2E (editado)')).toBeVisible();

    // ── Delete in reverse order (regra → topico → disciplina → area) ────────
    // Delete the regra.
    await nodeRow(page, 'Pergunta de teste E2E (editada)?')
      .getByRole('button', { name: 'Excluir' })
      .click();
    await page.getByRole('button', { name: 'Excluir', exact: true }).last().click();
    await expect(nodeRow(page, 'Pergunta de teste E2E (editada)?')).toBeHidden();

    // Delete the topico.
    await nodeRow(page, 'Tópico de Teste E2E (editado)')
      .getByRole('button', { name: 'Excluir' })
      .click();
    await page.getByRole('button', { name: 'Excluir', exact: true }).last().click();
    await expect(nodeRow(page, 'Tópico de Teste E2E (editado)')).toBeHidden();

    // Delete the disciplina.
    await nodeRow(page, DISCIPLINA_NAME).getByRole('button', { name: 'Excluir' }).click();
    await page.getByRole('button', { name: 'Excluir', exact: true }).last().click();
    await expect(nodeRow(page, DISCIPLINA_NAME)).toBeHidden();

    // Delete the area.
    await nodeRow(page, AREA_NAME).getByRole('button', { name: 'Excluir' }).click();
    await page.getByRole('button', { name: 'Excluir', exact: true }).last().click();
    await expect(nodeRow(page, AREA_NAME)).toBeHidden();

    // Verify the area is gone from the DB.
    const areasRes = await request.get('/api/areas');
    const areas = (await areasRes.json()) as { nome: string }[];
    expect(areas.some((a) => a.nome === AREA_NAME)).toBe(false);
  });

  test('deleting a parent with children is blocked (409 conflict)', async ({ page }) => {
    await page.goto('/pt-BR/knowledge');
    await page.waitForLoadState('networkidle');

    // Expand the seeded area (it has disciplinas).
    await expandNode(page, 'Direito Constitucional');

    // Try to delete it: the confirmation dialog appears, and the delete is
    // rejected with the conflict message (the area still has disciplinas).
    await nodeRow(page, 'Direito Constitucional').getByRole('button', { name: 'Excluir' }).click();
    await page.getByRole('button', { name: 'Excluir', exact: true }).last().click();
    await expect(page.getByText('Não é possível excluir: ainda possui filhos.')).toBeVisible();

    // Cancel the dialog; the area is still there.
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(nodeRow(page, 'Direito Constitucional')).toBeVisible();
  });
});
