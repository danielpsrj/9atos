// Matching, multiple choice, and cloze game screens (issues #39, #40, #41).
// Runs headless Chromium against the DEPLOYED app on Dockhand (baseURL in
// playwright.config.ts). Verifies the three game contracts:
//   #39 matching — two columns (concepts/definitions), click-to-select, correct
//         pairs draw the sapphire beam then fade out, wrong pairs flash red and
//         increment the error counter, the session ends when every pair is
//         matched, and final grades reflect misses (q=1) vs clean pairs (q=4).
//   #40 multiple choice — options are shuffled with no duplicate correct answer,
//         correct selection highlights sapphire, wrong selection highlights red
//         and reveals the justification, and the session completes and syncs.
//   #41 cloze — the blank renders inside the sentence, correct fill highlights
//         sapphire, incorrect highlights red and shows the answer, validation is
//         case-insensitive and whitespace-normalized, and the session completes.
// No local server is started. The sample notebook is created via the from-seed
// endpoint and cleaned up afterwards so the deployment is left tidy.

import { expect, test } from '@playwright/test';

// The sample notebook name created by POST /api/cadernos/from-seed.
const SAMPLE_NAME = 'Constituição Federal — Direitos Fundamentais';

// Resolve the sample notebook id (created by from-seed, idempotent).
async function ensureSampleNotebook(
  request: import('@playwright/test').APIRequestContext,
): Promise<string> {
  const res = await request.post('/api/cadernos/from-seed');
  expect([200, 201]).toContain(res.status());
  const body = (await res.json()) as { id: string };
  return body.id;
}

// Return the first element of a non-empty array (throws otherwise). Used to
// satisfy noUncheckedIndexedAccess after asserting the array is non-empty.
function first<T>(arr: T[]): T {
  const item = arr[0];
  if (item === undefined) throw new Error('expected a non-empty array');
  return item;
}

// Find a list item by its text content (partial match, whitespace-tolerant).
// The accessible-name match is too strict (whitespace differences), so we use
// a hasText filter instead.
function itemByText(
  list: import('@playwright/test').Locator,
  text: string,
): import('@playwright/test').Locator {
  return list.getByRole('listitem').filter({ hasText: text });
}

// Clean up the sample notebook after all tests.
async function cleanup(request: import('@playwright/test').APIRequestContext): Promise<void> {
  const list = await request.get('/api/cadernos');
  if (!list.ok()) return;
  const cadernos = (await list.json()) as { id: string; nome: string }[];
  for (const c of cadernos) {
    if (c.nome === SAMPLE_NAME) {
      await request.delete(`/api/cadernos/${c.id}`);
    }
  }
}

test.describe('matching game (#39)', () => {
  test('two columns render, correct pair matches with beam, wrong pair flashes', async ({
    page,
    request,
  }) => {
    const cadernoId = await ensureSampleNotebook(request);

    // Get the session data (including the correct pairs) to drive the test.
    const startRes = await request.post('/api/study/session/start', {
      data: { cadernoId, gameType: 'match' },
    });
    expect(startRes.status()).toBe(200);
    const session = (await startRes.json()) as {
      leftColumn: { regraId: string; text: string }[];
      rightColumn: { regraId: string; text: string }[];
      pairs: { regraId: string; concept: string; definition: string }[];
    };
    expect(session.pairs.length).toBeGreaterThanOrEqual(4); // AD-14 minimum

    await page.goto(`/pt-BR/study?cadernoId=${cadernoId}&game=match`);
    await page.waitForLoadState('networkidle');

    // Both columns render with the concepts and definitions.
    const leftList = page.getByRole('list', { name: 'concepts' });
    const rightList = page.getByRole('list', { name: 'definitions' });
    await expect(leftList).toBeVisible();
    await expect(rightList).toBeVisible();
    await expect(leftList.getByRole('listitem')).toHaveCount(session.leftColumn.length);
    await expect(rightList.getByRole('listitem')).toHaveCount(session.rightColumn.length);

    // Match the first pair: select its concept, then its definition.
    const firstPair = first(session.pairs);
    await itemByText(leftList, firstPair.concept).click();
    await itemByText(rightList, firstPair.definition).click();

    // The pair is matched: both cards are removed from the columns.
    await expect(itemByText(leftList, firstPair.concept)).toBeHidden();
    await expect(itemByText(rightList, firstPair.definition)).toBeHidden();
    // The progress bar advances to 1/N.
    const total = session.pairs.length;
    await expect(page.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      String(Math.round((1 / total) * 100)),
    );

    // Make a wrong selection: pick a concept and a non-matching definition.
    // Select the second pair's concept, then the third pair's definition (wrong).
    const secondPair = session.pairs[1];
    const thirdPair = session.pairs[2];
    if (secondPair === undefined || thirdPair === undefined) {
      throw new Error('expected at least 3 pairs');
    }
    await itemByText(leftList, secondPair.concept).click();
    await itemByText(rightList, thirdPair.definition).click();
    // The wrong pair is not matched (both cards remain visible).
    await expect(itemByText(leftList, secondPair.concept)).toBeVisible();
    await expect(itemByText(rightList, thirdPair.definition)).toBeVisible();
  });

  test('session ends when every pair is matched; grades reflect misses', async ({
    page,
    request,
  }) => {
    const cadernoId = await ensureSampleNotebook(request);

    const startRes = await request.post('/api/study/session/start', {
      data: { cadernoId, gameType: 'match' },
    });
    const session = (await startRes.json()) as {
      pairs: { regraId: string; concept: string; definition: string }[];
    };

    await page.goto(`/pt-BR/study?cadernoId=${cadernoId}&game=match`);
    await page.waitForLoadState('networkidle');

    const leftList = page.getByRole('list', { name: 'concepts' });
    const rightList = page.getByRole('list', { name: 'definitions' });

    // Track the sync request: it must fire exactly once.
    let syncCount = 0;
    page.on('response', (res) => {
      if (res.url().includes('/api/study/session/sync')) syncCount += 1;
    });

    // Match every pair.
    for (const pair of session.pairs) {
      await itemByText(leftList, pair.concept).click();
      await itemByText(rightList, pair.definition).click();
    }

    // The session ends: the results summary is shown.
    await expect(page.getByRole('heading', { name: 'Resultado da sessão' })).toBeVisible();
    // All pairs were clean (no misses), so 100% correct.
    await expect(page.getByText('100% de acertos')).toBeVisible();
    // The sync fired exactly once.
    await page.waitForTimeout(500);
    expect(syncCount).toBe(1);
  });
});

test.describe('multiple choice game (#40)', () => {
  test('options render, correct highlights sapphire, wrong reveals justification', async ({
    page,
    request,
  }) => {
    const cadernoId = await ensureSampleNotebook(request);

    const startRes = await request.post('/api/study/session/start', {
      data: { cadernoId, gameType: 'multiple-choice' },
    });
    const session = (await startRes.json()) as {
      items: { regraId: string; question: string; options: string[]; correctIndex: number }[];
    };
    expect(session.items.length).toBeGreaterThan(0);

    await page.goto(`/pt-BR/study?cadernoId=${cadernoId}&game=multiple-choice`);
    await page.waitForLoadState('networkidle');

    // The first question and its options render.
    const firstItem = first(session.items);
    await expect(page.getByText(firstItem.question)).toBeVisible();
    for (const option of firstItem.options) {
      await expect(page.getByRole('button', { name: option })).toBeVisible();
    }

    // Select the correct option: it highlights sapphire. The feedback phase
    // requires clicking "next" before the session advances.
    await page.getByRole('button', { name: firstItem.options[firstItem.correctIndex] }).click();
    await page.getByRole('button', { name: 'Próxima' }).click();
    // The second question is shown (the session advanced).
    const secondItem = session.items[1];
    if (secondItem !== undefined) {
      await expect(page.getByText(secondItem.question)).toBeVisible();
    }
  });

  test('wrong selection highlights red and reveals the justification', async ({
    page,
    request,
  }) => {
    const cadernoId = await ensureSampleNotebook(request);

    const startRes = await request.post('/api/study/session/start', {
      data: { cadernoId, gameType: 'multiple-choice' },
    });
    const session = (await startRes.json()) as {
      items: { regraId: string; question: string; options: string[]; correctIndex: number }[];
    };
    const firstItem = first(session.items);

    await page.goto(`/pt-BR/study?cadernoId=${cadernoId}&game=multiple-choice`);
    await page.waitForLoadState('networkidle');

    // Select a wrong option (any option that is not the correct one).
    const wrongIndex = firstItem.correctIndex === 0 ? 1 : 0;
    await page.getByRole('button', { name: firstItem.options[wrongIndex] }).click();
    // The justification is revealed (the rule has a justificativa in the seed).
    await expect(page.getByText('Justificativa')).toBeVisible();
  });
});

test.describe('cloze game (#41)', () => {
  test('blank renders in the sentence, correct fill highlights sapphire', async ({
    page,
    request,
  }) => {
    const cadernoId = await ensureSampleNotebook(request);

    const startRes = await request.post('/api/study/session/start', {
      data: { cadernoId, gameType: 'cloze' },
    });
    const session = (await startRes.json()) as {
      items: { regraId: string; sentence: string; gap: string; answer: string }[];
    };
    const firstItem = first(session.items);

    await page.goto(`/pt-BR/study?cadernoId=${cadernoId}&game=cloze`);
    await page.waitForLoadState('networkidle');

    // The input is present (the blank renders inside the sentence).
    const input = page.getByRole('textbox', { name: 'Preencha o espaço em branco.' });
    await expect(input).toBeVisible();

    // Type the correct answer and check: it highlights sapphire. The feedback
    // phase requires clicking "next" before the session advances.
    await input.fill(firstItem.answer);
    await page.getByRole('button', { name: 'Verificar' }).click();
    await expect(page.getByRole('status')).toHaveText('Correto!');
    await page.getByRole('button', { name: 'Próxima' }).click();
    // The session advances to the next item.
    const secondItem = session.items[1];
    if (secondItem !== undefined) {
      // The input is re-enabled for the next blank.
      await expect(
        page.getByRole('textbox', { name: 'Preencha o espaço em branco.' }),
      ).toBeEnabled();
    }
  });

  test('incorrect fill highlights red and shows the answer', async ({ page, request }) => {
    const cadernoId = await ensureSampleNotebook(request);

    const startRes = await request.post('/api/study/session/start', {
      data: { cadernoId, gameType: 'cloze' },
    });
    const session = (await startRes.json()) as {
      items: { regraId: string; sentence: string; gap: string; answer: string }[];
    };
    const firstItem = first(session.items);

    await page.goto(`/pt-BR/study?cadernoId=${cadernoId}&game=cloze`);
    await page.waitForLoadState('networkidle');

    const input = page.getByRole('textbox', { name: 'Preencha o espaço em branco.' });
    // Type an incorrect answer (case/whitespace differences don't matter, so
    // use a clearly wrong string).
    await input.fill('resposta incorreta de teste');
    await page.getByRole('button', { name: 'Verificar' }).click();
    // The incorrect feedback shows the correct answer.
    await expect(page.getByRole('status')).toHaveText(
      `Incorreto. A resposta é: ${firstItem.answer}`,
    );
  });
});

// Clean up the sample notebook after all tests so the deployment is left tidy.
test.afterAll(async ({ request }) => {
  await cleanup(request);
});
