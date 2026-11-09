import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://192.168.1.207:3005/pt-BR');
await page.waitForLoadState('networkidle');
await page.keyboard.press('Tab'); // active link
await page.keyboard.press('Tab'); // inactive link (Cadernos)
const info = await page.evaluate(() => {
  const el = document.activeElement;
  const cs = getComputedStyle(el);
  // Probe var(--primary) resolution in this element's context.
  const probe = document.createElement('span');
  probe.style.color = 'var(--primary)';
  el.appendChild(probe);
  const primaryResolved = getComputedStyle(probe).color;
  probe.remove();
  // Check the element's own color (text color).
  return {
    text: (el.textContent || '').slice(0, 20),
    elementColor: cs.color,
    outlineColor: cs.outlineColor,
    varPrimaryResolved: primaryResolved,
    // List all CSS rules that set outline-color and match this element.
    outlineRules: Array.from(document.styleSheets)
      .flatMap((ss) => {
        try { return Array.from(ss.cssRules); } catch { return []; }
      })
      .filter((r) => r.style && r.style.outlineColor)
      .map((r) => ({ sel: r.selectorText, oc: r.style.outlineColor, imp: r.style.getPropertyPriority('outline-color') })),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
