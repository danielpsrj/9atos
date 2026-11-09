import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://192.168.1.207:3005/pt-BR');
await page.waitForLoadState('networkidle');

for (let i = 1; i <= 6; i++) {
  await page.keyboard.press('Tab');
  const info = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName,
      text: (el.textContent || '').slice(0, 20),
      outlineColor: cs.outlineColor,
      isFocusVisible: el.matches(':focus-visible'),
    };
  });
  console.log(`Tab ${i}:`, JSON.stringify(info));
}
await browser.close();
