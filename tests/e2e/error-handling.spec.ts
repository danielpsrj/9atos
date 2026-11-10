// Error handling (issue #48, NFR-07). Runs headless Chromium against the
// DEPLOYED app on Dockhand (baseURL in playwright.config.ts). Verifies:
//   - all four security headers are present on every response and the CSP is
//     self-only (no third-party origins);
//   - forcing an API failure shows a toast AND a recoverable error state (no
//     white screen);
//   - toast severities use the correct colors (red error / gold success);
//   - the error boundary catches a render error and shows a themed fallback
//     with a retry action.
// No local server is started. Any notebook created is cleaned up afterwards.

import { expect, test, type Page } from '@playwright/test';

// The seeded regra to select (id regra-01), and the hierarchy path to it.
const SEEDED_REGRA =
  'Quais são os fundamentos da República Federativa do Brasil segundo o Art. 1º, caput?';
const AREA_NAME = 'Direito Constitucional';
const DISCIPLINA_NAME = 'Direitos e Garantias Fundamentais';
const TOPICO_NAME = 'Princípios Básicos (Art. 1º)';

async function expandNode(page: Page, name: string): Promise<void> {
  await page
    .locator('div.group')
    .filter({ has: page.locator('span.min-w-0').filter({ hasText: name }) })
    .getByRole('button', { name: 'Expandir' })
    .click();
}

async function expandToSeededRegra(page: Page): Promise<void> {
  await expandNode(page, AREA_NAME);
  await expandNode(page, DISCIPLINA_NAME);
  await expandNode(page, TOPICO_NAME);
}

test.describe('error handling (#48)', () => {
  test('all four security headers are present and the CSP is self-only', async ({ request }) => {
    const res = await request.get('/pt-BR/');
    expect(res.ok()).toBeTruthy();
    const headers = res.headers();
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    const csp = headers['content-security-policy'];
    expect(csp, 'CSP header should be present').toBeDefined();
    // Self-only: the default source is 'self' and no external origin appears.
    expect(csp).toContain("default-src 'self'");
    expect(csp).not.toContain('http://');
    expect(csp).not.toContain('https://');
  });

  test('forcing an API failure shows a toast and a recoverable state', async ({
    page,
    request,
  }) => {
    // Clean up any leftover test notebook, then create one.
    const listRes = await request.get('/api/cadernos');
    if (listRes.ok()) {
      const cadernos = (await listRes.json()) as { id: string; nome: string }[];
      for (const c of cadernos) {
        if (c.nome.includes('Toast E2E')) await request.delete(`/api/cadernos/${c.id}`);
      }
    }
    const createRes = await request.post('/api/cadernos', {
      data: { nome: 'Caderno Toast E2E' },
    });
    const caderno = (await createRes.json()) as { id: string };

    await page.goto('/pt-BR/notebooks');
    await page.waitForLoadState('networkidle');
    await expandToSeededRegra(page);
    await page.getByRole('checkbox', { name: SEEDED_REGRA }).check();

    // Force the add-rule API to fail with a 500.
    await page.route('**/api/cadernos/*/regras', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'boom' } }),
      }),
    );

    await page.getByRole('button', { name: 'Adicionar ao caderno' }).click();

    // An error toast appears (red accent).
    await expect(page.locator('.cn-toast[data-type="error"]')).toBeVisible();
    // The recoverable error state is shown — not a blank screen.
    await expect(
      page.getByText('Não foi possível adicionar as regras. Tente novamente.'),
    ).toBeVisible();

    // Clean up.
    await page.unroute('**/api/cadernos/*/regras');
    await request.delete(`/api/cadernos/${caderno.id}`);
  });

  test('toast severities use the correct colors (red error / gold success)', async ({
    page,
    request,
  }) => {
    // Clean up any leftover test notebook, then create one.
    const listRes = await request.get('/api/cadernos');
    if (listRes.ok()) {
      const cadernos = (await listRes.json()) as { id: string; nome: string }[];
      for (const c of cadernos) {
        if (c.nome.includes('Toast E2E')) await request.delete(`/api/cadernos/${c.id}`);
      }
    }
    const createRes = await request.post('/api/cadernos', {
      data: { nome: 'Caderno Toast E2E' },
    });
    const caderno = (await createRes.json()) as { id: string };

    await page.goto('/pt-BR/notebooks');
    await page.waitForLoadState('networkidle');
    await expandToSeededRegra(page);
    await page.getByRole('checkbox', { name: SEEDED_REGRA }).check();

    // Success path: the add succeeds → a gold success toast.
    await page.getByRole('button', { name: 'Adicionar ao caderno' }).click();
    const successToast = page.locator('.cn-toast[data-type="success"]');
    await expect(successToast).toBeVisible();
    const successBorder = await successToast.evaluate((el) => getComputedStyle(el).borderTopColor);
    // Gold --accent #fbbf24 = rgb(251, 191, 36).
    expect(successBorder).toBe('rgb(251, 191, 36)');

    // Error path: select another regra, force the API to fail → a red error
    // toast. (The first regra is now in the notebook, so select a sibling.)
    await page
      .getByRole('checkbox', {
        name: 'O Art. 1º, §1º, da CF/88 estabelece que todo poder emana de quem?',
      })
      .check();
    await page.route('**/api/cadernos/*/regras', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'boom' } }),
      }),
    );
    await page.getByRole('button', { name: 'Adicionar ao caderno' }).click();
    const errorToast = page.locator('.cn-toast[data-type="error"]');
    await expect(errorToast).toBeVisible();
    const errorBorder = await errorToast.evaluate((el) => getComputedStyle(el).borderTopColor);
    // Red --error #f87171 = rgb(248, 113, 113).
    expect(errorBorder).toBe('rgb(248, 113, 113)');

    // Clean up.
    await page.unroute('**/api/cadernos/*/regras');
    await request.delete(`/api/cadernos/${caderno.id}`);
  });

  test('the error boundary catches a render error and shows a fallback with retry', async ({
    page,
  }) => {
    // The test-only route renders a component that throws during client
    // rendering. The ErrorBoundary (in the shell layout) catches it and shows
    // the themed fallback with a retry action — not a white screen.
    await page.goto('/pt-BR/error-boundary-test');
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByText('Algo deu errado')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
  });
});
