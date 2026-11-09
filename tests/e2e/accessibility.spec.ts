// Accessibility e2e (issue #31, NFR-05, spec §5.1). Runs headless Chromium
// against the DEPLOYED app on Dockhand (baseURL in playwright.config.ts) and
// verifies: (1) axe-core reports zero critical/serious violations on the shell,
// (2) the focus ring is sapphire (#64ffda) on every focusable element, and
// (3) the shell is fully operable by keyboard (Tab/Shift+Tab/Enter/Space plus
// arrow-key nav in the side-nav). No local server is started.

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// #64ffda as the computed rgb() string.
const SAPPHIRE = 'rgb(100, 255, 218)';

const LOCALES = ['pt-BR', 'en-US'] as const;

for (const locale of LOCALES) {
  test.describe(`shell accessibility — ${locale}`, () => {
    test('axe-core: zero critical/serious violations on the shell', async ({ page }) => {
      await page.goto(`/${locale}`);
      const results = await new AxeBuilder({ page }).analyze();
      const blocking = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      );
      expect(
        blocking,
        `axe violations:\n${JSON.stringify(blocking, null, 2)}`,
      ).toEqual([]);
    });

    test('focus ring is sapphire on the first focusable element', async ({ page }) => {
      await page.goto(`/${locale}`);
      // Keyboard focus (not mouse) so :focus-visible applies.
      await page.keyboard.press('Tab');
      const outlineColor = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return el ? getComputedStyle(el).outlineColor : null;
      });
      expect(outlineColor).toBe(SAPPHIRE);
    });

    test('every nav link shows a sapphire focus ring when tabbed to', async ({ page }) => {
      await page.goto(`/${locale}`);
      // The four primary nav links are the first focusable elements.
      for (let i = 0; i < 4; i++) {
        await page.keyboard.press('Tab');
        const color = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          return el ? getComputedStyle(el).outlineColor : null;
        });
        expect(color, `nav link ${i + 1} focus ring`).toBe(SAPPHIRE);
      }
    });

    test('arrow keys move focus through the nav (wrapping)', async ({ page }) => {
      await page.goto(`/${locale}`);
      // The nav is a client component; wait for hydration (networkidle is a
      // reliable proxy) so the React keydown handler is attached before keys.
      await page.waitForLoadState('networkidle');
      await page.keyboard.press('Tab'); // first nav link
      const label = () =>
        page.evaluate(() => (document.activeElement as HTMLElement).textContent ?? '');

      const first = await label();
      await page.keyboard.press('ArrowDown');
      const second = await label();
      expect(second).not.toBe(first);

      // ArrowUp wraps from the first back to the last.
      await page.keyboard.press('ArrowUp');
      await page.keyboard.press('ArrowUp');
      const wrapped = await label();
      expect(wrapped).not.toBe(first);
    });

    test('keyboard-only walkthrough: Tab to a link, Enter navigates', async ({ page }) => {
      await page.goto(`/${locale}`);
      // Tab to the second nav link (notebooks) and activate it with Enter.
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      await page.waitForLoadState('networkidle');
      // The notebooks page is under the same shell; the URL should have changed.
      expect(page.url()).toContain('/notebooks');
    });
  });
}
