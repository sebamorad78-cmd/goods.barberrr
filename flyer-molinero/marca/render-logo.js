// Exporta el logo en PNG con fondo transparente (x3 de resolución)
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 3 });
  for (const v of ['badge-musgo', 'badge-beige', 'lockup-oscuro', 'lockup-claro']) {
    await p.goto('file://' + path.join(__dirname, 'logo.html') + '?v=' + v, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    await p.locator('#root').screenshot({ path: path.join(__dirname, `logo-${v}.png`), omitBackground: true });
  }
  await b.close();
})();
