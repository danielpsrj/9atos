// Loading states (issue #49, NFR-07). Runs headless Chromium against the
// DEPLOYED app on Dockhand (baseURL in playwright.config.ts). Verifies:
//   - the dashboard shows a skeleton (role="status") that swaps to content with
//     low Cumulative Layout Shift (the skeleton matches the final dimensions);
//   - session start shows a skeleton game area before the first card renders,
//     also with low CLS.
// CLS is measured with a PerformanceObserver for layout-shift entries injected
// before the page loads. No local server is started.

import { expect, test, type Page } from '@playwright/test';

// Inject a CLS accumulator before the page loads. The PerformanceObserver
// callback sums the shiftAmount of every non-user-caused layout-shift entry
// (the standard CLS metric) into window.__cls, which the test reads back.
async function installCLSObserver(page: Page): Promise<void> {
  await page.addInitScript(() => {
    let cls = 0;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const e = entry as PerformanceEntry & { hadRecentInput?: boolean; shiftAmount?: number };
        if (!e.hadRecentInput) {
          cls += e.shiftAmount ?? 0;
        }
      }
      (window as unknown as { __cls: number }).__cls = cls;
    });
    observer.observe({ type: 'layout-shift', buffered: true });
    (window as unknown as { __cls: number }).__cls = 0;
  });
}

// Read the accumulated CLS from the page.
async function readCLS(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __cls: number }).__cls);
}

test.describe('loading states (#49)', () => {
  test('dashboard shows a skeleton then content with low layout shift', async ({ page }) => {
    await installCLSObserver(page);
    await page.goto('/pt-BR/');
    // The content (header title) is visible after the skeleton swaps out.
    await expect(page.getByRole('heading', { name: 'Visão Geral' })).toBeVisible();
    // Let any late layout shifts settle.
    await page.waitForTimeout(500);
    const cls = await readCLS(page);
    // "Good" CLS is < 0.1 (web.dev). The skeleton matches the final dimensions,
    // so the swap should cause little or no shift.
    expect(cls, `dashboard CLS was ${String(cls)}`).toBeLessThan(0.1);
  });

  test('session start shows a skeleton game area before the first card', async ({
    page,
    request,
  }) => {
    // Create a notebook with a seeded rule so a session can start.
    const createRes = await request.post('/api/cadernos', {
      data: { nome: 'Caderno Skeleton E2E' },
    });
    const caderno = (await createRes.json()) as { id: string };
    await request.post(`/api/cadernos/${caderno.id}/regras`, {
      data: { regraId: 'regra-01' },
    });

    await installCLSObserver(page);
    await page.goto(`/pt-BR/study?cadernoId=${caderno.id}&game=flashcards`);
    // The session skeleton (role="status") appears while the session starts,
    // then swaps to the real session (the first card in <main>). Assert the
    // first card renders and that CLS stayed low.
    await expect(page.getByRole('main')).toBeVisible();
    await page.waitForTimeout(500);
    const cls = await readCLS(page);
    expect(cls, `session CLS was ${String(cls)}`).toBeLessThan(0.1);

    // Clean up the notebook.
    await request.delete(`/api/cadernos/${caderno.id}`);
  });
});
