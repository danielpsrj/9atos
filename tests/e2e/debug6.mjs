import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://192.168.1.207:3005/pt-BR');
await page.waitForLoadState('networkidle');
await page.keyboard.press('Tab');
await page.keyboard.press('Tab'); // inactive link
const info = await page.evaluate(() => {
  const el = document.activeElement;
  // Recursively collect ALL rules (including inside @layer) that set outline-color.
  const all = [];
  function walk(rules) {
    for (const r of rules) {
      if (r.cssRules) walk(r.cssRules);
      if (r.style && r.style.outlineColor) {
        all.push({ sel: r.selectorText, oc: r.style.outlineColor, imp: r.style.getPropertyPriority('outline-color') });
      }
    }
  }
  for (const ss of document.styleSheets) {
    try { walk(ss.cssRules); } catch (e) { all.push({ error: String(e) }); }
  }
  // Also check the cascade layers order.
  const layers = [];
  for (const ss of document.styleSheets) {
    try {
      for (const r of ss.cssRules) {
        if (r.constructor.name === 'CSSLayerBlockRule' || r.layerName) layers.push(r.layerName);
      }
    } catch {}
  }
  return { outlineColorRules: all, layerOrder: layers };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
