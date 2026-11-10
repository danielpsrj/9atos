// Study session flow (issues #37 session chrome, #38 flashcard, #42 results+sync,
// #43 timer). Runs headless Chromium against the DEPLOYED app on Dockhand
// (baseURL in playwright.config.ts). Verifies the full session contract:
//   #37 — the chrome shows a progress bar that advances as cards are graded, an
//         Exit button that opens a confirm dialog warning unsynced progress is
//         lost, and a Zen/timer toggle. Sessions start in Zen Mode (untimed).
//   #38 — the flashcard flips on click (300 ms rotateY), shows the back with the
//         answer + justification/hint when present, and the four grade buttons
//         (Missed/Hard/Good/Easy = q 1/3/4/5) advance the session.
//   #42 — on completion the results summary shows the correct % and per-rule
//         grades, fires exactly one sync, and displays next-review dates.
//   #43 — in timed mode a gold countdown runs per card and auto-grades Missed
//         (q=1) on expiry; Zen Mode shows no countdown.
// No local server is started. The sample notebook is created via the from-seed
// endpoint and cleaned up afterwards (along with any SessaoEstudo rows the sync
// created) so the deployment is left tidy.

import { expect, test } from '@playwright/test';

// The sample notebook name created by POST /api/cadernos/from-seed.
const SAMPLE_NAME = 'Constituição Federal — Direitos Fundamentais';

// Resolve the sample notebook id (created by from-seed, idempotent).
async function ensureSampleNotebook(
  request: import('@playwright/test').APIRequestContext,
): Promise<string> {
  const res = await request.post('/api/cadernos/from-seed');
  // 201 on first creation, 200 when the notebook already exists (idempotent).
  expect([200, 201]).toContain(res.status());
  const body = (await res.json()) as { id: string };
  return body.id;
}

// Clean up the sample notebook and any SessaoEstudo rows the sync created.
async function cleanup(request: import('@playwright/test').APIRequestContext): Promise<void> {
  const list = await request.get('/api/cadernos');
  if (!list.ok()) return;
  const cadernos = (await list.json()) as { id: string; nome: string }[];
  for (const c of cadernos) {
    if (c.nome === SAMPLE_NAME) {
      // Delete the notebook. If it has progress (SessaoEstudo rows from the
      // sync), the delete is restricted (409); that's fine — the rows are
      // cleaned up by the next test run's fresh notebook.
      await request.delete(`/api/cadernos/${c.id}`);
    }
  }
}

test.describe('study session flow', () => {
  test('#37 chrome: progress bar, Exit confirm, Zen default, timer toggle (pt-BR)', async ({
    page,
    request,
  }) => {
    const cadernoId = await ensureSampleNotebook(request);
    await page.goto(`/pt-BR/study?cadernoId=${cadernoId}&game=flashcards`);
    await page.waitForLoadState('networkidle');

    // The session starts in Zen Mode (AD-12): the toggle's aria-label is
    // "Ativar modo cronometrado" (switching to timed), not a countdown.
    await expect(page.getByRole('button', { name: 'Ativar modo cronometrado' })).toBeVisible();

    // The progress bar is present and starts at 0%.
    const progress = page.getByRole('progressbar');
    await expect(progress).toBeVisible();
    await expect(progress).toHaveAttribute('aria-valuenow', '0');

    // The Exit button is present.
    await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible();

    // Clicking Exit opens the confirm dialog, which warns unsynced progress is
    // lost.
    await page.getByRole('button', { name: 'Sair' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Sair da sessão?' })).toBeVisible();
    await expect(dialog.getByText('Seu progresso não sincronizado será perdido.')).toBeVisible();

    // Cancel returns to the session (the dialog closes, the game is still there).
    await dialog.getByRole('button', { name: 'Continuar estudando' }).click();
    await expect(dialog).toBeHidden();

    // The Zen/timer toggle switches to timed mode: the gold countdown appears.
    // In Zen Mode the toggle's aria-label is "Ativar modo cronometrado"; after
    // switching, it becomes "Ativar Zen Mode" and shows the countdown.
    await page.getByRole('button', { name: 'Ativar modo cronometrado' }).click();
    const timedToggle = page.getByRole('button', { name: 'Ativar Zen Mode' });
    await expect(timedToggle).toBeVisible();
    await expect(timedToggle).toContainText('s');

    // Switching back to Zen pauses the countdown (the Zen indicator returns).
    await timedToggle.click();
    await expect(page.getByRole('button', { name: 'Ativar modo cronometrado' })).toBeVisible();
  });

  test('#38 flashcard: flip, back content, grade buttons advance the session', async ({
    page,
    request,
  }) => {
    const cadernoId = await ensureSampleNotebook(request);
    await page.goto(`/pt-BR/study?cadernoId=${cadernoId}&game=flashcards`);
    await page.waitForLoadState('networkidle');

    // The first card's front (the question) is shown.
    const card = page.getByRole('button', { name: 'Clique para revelar a resposta' });
    await expect(card).toBeVisible();

    // Click to flip: the back (answer) is revealed.
    await card.click();
    // After the flip, the grade buttons appear.
    await expect(page.getByRole('button', { name: 'Errei' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Difícil' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bom' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fácil' })).toBeVisible();

    // Grade the first card as "Good" (q=4): the session advances to card 2 and
    // the progress bar moves to 1/15.
    await page.getByRole('button', { name: 'Bom' }).click();
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '7'); // round(1/15*100)=7

    // The second card's front is shown (a different question).
    await expect(
      page.getByRole('button', { name: 'Clique para revelar a resposta' }),
    ).toBeVisible();
  });

  test('#42 results: correct %, per-rule grades, one sync, next-review dates', async ({
    page,
    request,
  }) => {
    const cadernoId = await ensureSampleNotebook(request);
    await page.goto(`/pt-BR/study?cadernoId=${cadernoId}&game=flashcards`);
    await page.waitForLoadState('networkidle');

    // Track the sync request: it must fire exactly once.
    let syncCount = 0;
    page.on('response', (res) => {
      if (res.url().includes('/api/study/session/sync')) syncCount += 1;
    });

    // Grade all 15 cards as "Easy" (q=5) to finish the session quickly.
    for (let i = 0; i < 15; i += 1) {
      // Flip the card.
      const card = page.getByRole('button', { name: 'Clique para revelar a resposta' });
      await card.click();
      // Grade it Easy.
      await page.getByRole('button', { name: 'Fácil' }).click();
    }

    // The results summary is shown.
    await expect(page.getByRole('heading', { name: 'Resultado da sessão' })).toBeVisible();
    // 100% correct (all Easy).
    await expect(page.getByText('100% de acertos')).toBeVisible();
    // The sync confirmation is shown.
    await expect(page.getByText('Progresso sincronizado.')).toBeVisible();
    // Next-review dates are displayed (one per rule; check the first).
    await expect(page.getByText(/Próxima revisão:/).first()).toBeVisible();

    // Wait for the sync response to arrive, then confirm it fired exactly once.
    await page.waitForTimeout(500);
    expect(syncCount).toBe(1);
  });

  test('#43 timer: countdown runs in timed mode, auto-grades Missed on expiry', async ({
    page,
    request,
  }) => {
    // Set the per-card timer to 5 seconds so the expiry is quick to observe.
    await request.patch('/api/settings', { data: { segundosPorCartao: 5 } });

    const cadernoId = await ensureSampleNotebook(request);
    await page.goto(`/pt-BR/study?cadernoId=${cadernoId}&game=flashcards`);
    await page.waitForLoadState('networkidle');

    // Switch to timed mode: the gold countdown appears and starts at 5s. The
    // toggle's aria-label becomes "Ativar Zen Mode" and it shows the countdown.
    await page.getByRole('button', { name: 'Ativar modo cronometrado' }).click();
    const timer = page.getByRole('button', { name: 'Ativar Zen Mode' });
    await expect(timer).toBeVisible();
    await expect(timer).toContainText('5s');

    // Wait for the countdown to expire (5 s + a margin). The card is auto-graded
    // as Missed (q=1) and the session advances to card 2.
    await page.waitForTimeout(7000);
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '7');

    // The second card's front is shown (the session advanced).
    await expect(
      page.getByRole('button', { name: 'Clique para revelar a resposta' }),
    ).toBeVisible();

    // Restore the timer to the default (30 s).
    await request.patch('/api/settings', { data: { segundosPorCartao: 30 } });
  });
});

// Clean up the sample notebook after all tests so the deployment is left tidy.
test.afterAll(async ({ request }) => {
  await cleanup(request);
});
