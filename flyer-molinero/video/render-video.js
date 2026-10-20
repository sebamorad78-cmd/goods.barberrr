// Uso: node render-video.js            -> video completo (julian-acebal-reel.mp4)
//      node render-video.js preview 1 5 -> capturas sueltas en esos segundos
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const FPS = 30;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto('file://' + path.join(__dirname, 'video.html'), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const [mode, ...ts] = process.argv.slice(2);
  if (mode === 'preview') {
    fs.mkdirSync(path.join(__dirname, 'preview'), { recursive: true });
    for (const t of ts) {
      await page.evaluate(t => seek(t), Number(t));
      await page.screenshot({ path: path.join(__dirname, 'preview', `t${t}.jpg`), type: 'jpeg', quality: 85 });
    }
  } else {
    const dir = path.join(__dirname, 'frames'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);
    const dur = await page.evaluate(() => window.DURATION), n = Math.round(dur * FPS);
    for (let i = 0; i < n; i++) {
      await page.evaluate(t => seek(t), i / FPS);
      await page.screenshot({ path: path.join(dir, String(i).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 93 });
    }
    execSync(`ffmpeg -y -loglevel error -framerate ${FPS} -i ${dir}/%04d.jpg -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -profile:v high -movflags +faststart ${path.join(__dirname, 'julian-acebal-reel.mp4')}`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
  await browser.close();
})();
