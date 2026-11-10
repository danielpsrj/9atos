// Smoke test (issue #50, FR-04/05/06/12). The end-to-end proof that the product
// works: seed → create notebook → start flashcard session → grade the card →
// sync → verify the SRS streak increments. Runs against a real ephemeral
// database + a locally-built app (see playwright.smoke.config.ts), so it passes
// in CI. The global-setup backdates the bootstrap user's ultimoAcesso to
// yesterday (Sao Paulo) and sets ofensivaAtual to 1, so a qualifying sync today
// increments the streak to 2 — a regression in any step (session start,
// grading, sync, streak) fails this test. Chromium only (plan §2.4).

import { expect, test } from '@playwright/test';

test.describe('full loop (#50)', () => {
  test('seed → notebook → flashcard session → grade → sync → streak increments', async ({
    page,
    request,
  }) => {
    // 1. Create a notebook and add the seeded regra-01 (never-studied → due now).
    const createRes = await request.post('/api/cadernos', {
      data: { nome: 'Smoke Caderno' },
    });
    expect(createRes.ok()).toBeTruthy();
    const caderno = (await createRes.json()) as { id: string };
    const addRes = await request.post(`/api/cadernos/${caderno.id}/regras`, {
      data: { regraId: 'regra-01' },
    });
    expect(addRes.ok()).toBeTruthy();

    // 2. The streak is 1 before the session (set by the global-setup backdate).
    const beforeRes = await request.get('/api/dashboard');
    expect(beforeRes.ok()).toBeTruthy();
    const before = (await beforeRes.json()) as { ofensivaAtual: number };
    expect(before.ofensivaAtual).toBe(1);

    // 3. Start a flashcard session via the UI.
    await page.goto(`/pt-BR/study?cadernoId=${caderno.id}&game=flashcards`);
    // The session skeleton shows, then the first card renders.
    const card = page.getByRole('button', { name: 'Clique para revelar a resposta' });
    await expect(card).toBeVisible();

    // 4. Flip the card to reveal the answer.
    await card.click();
    // The grade buttons appear after the reveal.
    const gradeGood = page.getByRole('button', { name: 'Bom' });
    await expect(gradeGood).toBeVisible();

    // 5. Grade the card (Bom = q 4). This completes the session (1 card) and
    //    fires exactly one sync.
    await gradeGood.click();

    // 6. The results summary shows, and the next-review date appears (which only
    //    renders after the sync response arrives — so the sync has completed).
    await expect(page.getByText('Resultado da sessão')).toBeVisible();
    await expect(page.getByText('Próxima revisão:')).toBeVisible();

    // 7. The streak incremented from 1 to 2 (the sync applied the grade and
    //    computed gap === 1 from the backdated ultimoAcesso).
    const afterRes = await request.get('/api/dashboard');
    expect(afterRes.ok()).toBeTruthy();
    const after = (await afterRes.json()) as { ofensivaAtual: number; maiorOfensiva: number };
    expect(after.ofensivaAtual).toBe(2);
    expect(after.maiorOfensiva).toBe(2);
  });
});
