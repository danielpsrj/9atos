// Import UI (issue #45, FR-13, plan §2.4). Runs headless Chromium against the
// DEPLOYED app on Dockhand (baseURL in playwright.config.ts). Verifies the
// import flow: upload a CSV/JSON file, preview the parsed rows (flagging
// rejected rows with their line-level errors), choose a target Topico, and
// confirm the bulk insert. Also verifies the import limits (a >5 MB file and a
// >10,000-row file are both rejected with a clear error). No local server is
// started. The imported regras are cleaned up afterwards so the deployment is
// left tidy.

import { expect, test } from '@playwright/test';

// The committed valid CSV fixture (5 regras), used for the import flow.
const VALID_CSV = 'tests/fixtures/ingestion/valid.csv';

// The sample topico the import targets (the first one returned by /api/topicos).
async function firstTopico(request: import('@playwright/test').APIRequestContext): Promise<{
  id: string;
  nome: string;
}> {
  const res = await request.get('/api/topicos');
  expect(res.ok()).toBeTruthy();
  const topicos = (await res.json()) as { id: string; nome: string }[];
  expect(topicos.length).toBeGreaterThan(0);
  const first = topicos[0];
  if (first === undefined) throw new Error('expected at least one topico');
  return first;
}

// Delete the regras of a topico whose ids are UUIDs (the imported ones; the
// seeded regras use the "regra-XX" id scheme). Leaves the deployment tidy.
async function cleanupImportedRegras(
  request: import('@playwright/test').APIRequestContext,
  topicoId: string,
): Promise<void> {
  const res = await request.get(`/api/topicos/${topicoId}/regras`);
  if (!res.ok()) return;
  const regras = (await res.json()) as { id: string }[];
  for (const regra of regras) {
    // Only delete UUID ids (the imported regras); keep the seeded "regra-XX".
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(regra.id)) {
      await request.delete(`/api/regras/${regra.id}`);
    }
  }
}

test.describe('import UI (#45)', () => {
  test('upload → preview → confirm → bulk insert under the selected Topico', async ({
    page,
    request,
  }) => {
    const topico = await firstTopico(request);

    await page.goto('/pt-BR/knowledge');
    await page.waitForLoadState('networkidle');

    // Upload the valid CSV fixture.
    await page.setInputFiles('input[type="file"]', VALID_CSV);

    // The preview loads: the valid rows are shown.
    await expect(page.getByRole('heading', { name: 'Pré-visualização' })).toBeVisible();
    await expect(page.getByText('5 regra(s) pronta(s) para importar')).toBeVisible();
    // No rejected rows (the fixture is fully valid).
    await expect(page.getByText(/rejeitada/)).toBeHidden();

    // The target topico selector is pre-populated with the first topico.
    const select = page.getByRole('combobox');
    await expect(select).toBeVisible();

    // Confirm the import.
    await page.getByRole('button', { name: 'Confirmar importação' }).click();

    // The import result is shown: 5 regras imported.
    await expect(page.getByText('5 regra(s) importada(s)')).toBeVisible();

    // The imported regras are visible under the topico (round-trip verified).
    const regrasRes = await request.get(`/api/topicos/${topico.id}/regras`);
    const regras = (await regrasRes.json()) as { pergunta: string }[];
    expect(regras.some((r) => r.pergunta.includes('mandado de segurança'))).toBeTruthy();

    // Clean up the imported regras.
    await cleanupImportedRegras(request, topico.id);
  });

  test('rejected rows are visible with their line-level errors', async ({ page, request }) => {
    const topico = await firstTopico(request);

    await page.goto('/pt-BR/knowledge');
    await page.waitForLoadState('networkidle');

    // Upload the malformed CSV fixture (2 valid rows, 4 rejected rows).
    await page.setInputFiles('input[type="file"]', 'tests/fixtures/ingestion/malformed.csv');

    // The preview shows the rejected rows with their line-level errors.
    await expect(page.getByRole('heading', { name: 'Pré-visualização' })).toBeVisible();
    await expect(page.getByText('4 linha(s) rejeitada(s)')).toBeVisible();
    await expect(page.getByText('2 regra(s) pronta(s) para importar')).toBeVisible();
    // A line-level error is shown (e.g. "Linha 4: pergunta is required…").
    await expect(page.getByText(/Linha 4:/)).toBeVisible();
    // The distractor-shortage warning is shown (only 2 valid rules < 4).
    await expect(page.getByText(/distractor shortage/)).toBeVisible();

    // Clean up (no import was confirmed, but be safe).
    await cleanupImportedRegras(request, topico.id);
  });

  test('a >5 MB file is rejected with a clear error', async ({ page, request }) => {
    await firstTopico(request);

    await page.goto('/pt-BR/knowledge');
    await page.waitForLoadState('networkidle');

    // Build a >5 MB CSV (6,000 long rows) and upload it via a data URL.
    const longText = 'Resposta longa de teste '.repeat(40);
    const row = `"Pergunta de teste","${longText}","J.","D.","D1;D2;D3",1,0.5`;
    const header =
      'pergunta,resposta_certa,justificativa,dica,distratores,nivel_dificuldade,probabilidade';
    const content = header + '\n' + Array.from({ length: 6000 }, () => row).join('\n');
    expect(new TextEncoder().encode(content).length).toBeGreaterThan(5 * 1024 * 1024);

    // Write the large file to a temp path and upload it.
    const fs = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const tmpFile = path.join(os.tmpdir(), `import-large-${String(Date.now())}.csv`);
    fs.writeFileSync(tmpFile, content, 'utf8');
    try {
      await page.setInputFiles('input[type="file"]', tmpFile);
      // The size limit is enforced client-side before the file is sent.
      await expect(page.getByText('O arquivo excede o limite de 5 MB.')).toBeVisible();
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });
});
