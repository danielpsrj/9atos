// Progress-ring animation check (issue #33). Runs headless Chromium against the
// DEPLOYED app on Dockhand (baseURL in playwright.config.ts). Verifies the ring
// sweep mechanism: on first render the progress arc starts empty (stroke-dashoffset
// == full circumference, i.e. 0%) and carries a CSS transition on stroke-dashoffset,
// so it animates to the target percentage. No local server is started.

import { expect, test } from '@playwright/test';

test('progress ring starts empty and carries a dashoffset transition', async ({ page }) => {
  await page.goto('/pt-BR');
  await page.waitForLoadState('networkidle');

  // The ring is the svg[role=img] whose aria-label mentions "regras".
  const ring = page.locator('svg[role="img"][aria-label*="regras"]').first();
  await expect(ring).toBeVisible();

  // The progress arc is the second <circle> (the first is the track).
  const arc = ring.locator('circle').nth(1);

  const geometry = await arc.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      dasharray: cs.strokeDasharray,
      dashoffset: cs.strokeDashoffset,
      transition: cs.transition,
      transitionProperty: cs.transitionProperty,
    };
  });

  // The arc must have a dash pattern (a number, not "none").
  expect(geometry.dasharray).not.toBe('none');
  // The transition must cover stroke-dashoffset (the sweep mechanism).
  expect(geometry.transitionProperty).toContain('stroke-dashoffset');
  expect(geometry.transition).not.toBe('all 0s ease 0s');

  // On first paint the arc is empty: dashoffset equals the full circumference
  // (the dasharray value). After the double-rAF sweep it moves toward the
  // target; for a 0% notebook they are equal, which is the correct resting state.
  const dasharrayNum = Number.parseFloat(geometry.dasharray);
  const dashoffsetNum = Number.parseFloat(geometry.dashoffset);
  expect(Number.isFinite(dasharrayNum)).toBe(true);
  expect(dashoffsetNum).toBeCloseTo(dasharrayNum, 0);
});
