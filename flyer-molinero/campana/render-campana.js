// Genera las 3 piezas de campaña en story (9:16) y post (4:5), a doble resolución
const { chromium } = require('playwright');
const path = require('path');
const F = { story: [1080, 1920], post: [1080, 1350] };
(async () => {
  const b = await chromium.launch();
  for (const p of ['solar', 'molino', 'hacienda']) for (const [f, [w, h]] of Object.entries(F)) {
    const pg = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    await pg.goto('file://' + path.join(__dirname, 'campana.html') + `?p=${p}&f=${f}`, { waitUntil: 'networkidle' });
    await pg.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
    await pg.locator('.ad').screenshot({ path: path.join(__dirname, `campana-${p}-${f}.jpg`), type: 'jpeg', quality: 95 });
    await pg.locator('.ad').screenshot({ path: path.join(__dirname, `campana-${p}-${f}.png`) });
    await pg.close();
  }
  await b.close();
})();
