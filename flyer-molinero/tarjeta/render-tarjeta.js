// Archivos de imprenta de la tarjeta: PDF vectorial (frente y dorso) + PNG a 600 dpi por cara
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const url = 'file://' + path.join(__dirname, 'tarjeta-imprenta.html');
  const pdf = await b.newPage();
  await pdf.goto(url, { waitUntil: 'networkidle' });
  await pdf.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
  await pdf.pdf({ path: path.join(__dirname, 'tarjeta-julian-acebal-IMPRENTA.pdf'), width: '96mm', height: '56mm', printBackground: true, preferCSSPageSize: true });
  // 96 mm a 600 dpi = 2268 px → escala 2268 / 363
  const png = await b.newPage({ viewport: { width: 400, height: 260 }, deviceScaleFactor: 2268 / 363 });
  await png.goto(url, { waitUntil: 'networkidle' });
  await png.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
  for (const cara of ['frente', 'dorso'])
    await png.locator('#' + cara).screenshot({ path: path.join(__dirname, `tarjeta-${cara}-600dpi.png`) });
  await b.close();
})();
