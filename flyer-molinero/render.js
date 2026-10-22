// Uso: node render.js '{"marca":"...","telefono":"..."}'
const { chromium } = require('playwright');
const path = require('path');
const data = process.argv[2] || '{}';
const FORMATS = { post: [1080, 1350], story: [1080, 1920] };
(async () => {
  const browser = await chromium.launch();
  for (const [fmt, [w, h]] of Object.entries(FORMATS)) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 3 });
    const url = 'file://' + path.join(__dirname, 'flyer.html') + `?format=${fmt}&data=${encodeURIComponent(data)}`;
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.flyer').screenshot({ path: path.join(__dirname, `flyer-${fmt}.png`) });
    await page.locator('.flyer').screenshot({ path: path.join(__dirname, `flyer-${fmt}.jpg`), type: 'jpeg', quality: 95 });
    await page.close();
  }
  await browser.close();
})();
