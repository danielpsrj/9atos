import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://192.168.1.207:3005/pt-BR');
await page.waitForLoadState('networkidle');

for (let i = 1; i <= 3; i++) {
  await page.keyboard.press('Tab');
  const info = await page.evaluate(() => {
    const el = document.activeElement;
    const cs = getComputedStyle(el);
    return {
      text: (el.textContent || '').slice(0, 16),
      tag: el.tagName,
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor,
      boxShadow: cs.boxShadow.slice(0, 60),
      classes: el.className.slice(0, 80),
    };
  });
  console.log(`Tab ${i}:`, JSON.stringify(info));
}
await browser.close();
