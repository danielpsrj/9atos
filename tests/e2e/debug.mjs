import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://192.168.1.207:3005/pt-BR');

const navCount = await page.evaluate(() => document.querySelectorAll('nav').length);
console.log('nav count:', navCount);

await page.keyboard.press('Tab');
const info = await page.evaluate(() => {
  const el = document.activeElement;
  if (!el) return { active: null };
  const cs = getComputedStyle(el);
  return {
    active: el.tagName + '.' + el.className,
    text: (el.textContent || '').slice(0, 30),
    outlineColor: cs.outlineColor,
    outlineWidth: cs.outlineWidth,
    outlineStyle: cs.outlineStyle,
    isFocusVisible: el.matches(':focus-visible'),
  };
});
console.log('after 1 Tab:', JSON.stringify(info, null, 2));

await page.keyboard.press('ArrowDown');
const after = await page.evaluate(() => {
  const el = document.activeElement;
  return el ? (el.textContent || '').slice(0, 30) : null;
});
console.log('after ArrowDown:', after);

await browser.close();
