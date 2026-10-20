// Uso: node render-video.js             -> 4K (2160x3840) + 1080x1920 + versión liviana para WhatsApp
//      node render-video.js preview 1 5  -> capturas sueltas en esos segundos (en preview/)
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), { spawn, execSync } = require('child_process');
const FPS = 30;
const out = n => path.join(__dirname, n);
(async () => {
  const [mode, ...ts] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: mode === 'preview' ? 1 : 2 });
  await page.goto('file://' + out('video.html'), { waitUntil: 'networkidle' });
  await page.evaluate(async () => { await document.fonts.ready; await window.ready; });
  if (mode === 'preview') {
    fs.mkdirSync(out('preview'), { recursive: true });
    for (const t of ts) {
      await page.evaluate(t => seek(t), Number(t));
      await page.screenshot({ path: out(`preview/t${t}.jpg`), type: 'jpeg', quality: 85 });
    }
  } else {
    // los cuadros van directo a ffmpeg, sin pasar por disco
    // master temporal en alta calidad; los entregables se codifican aparte con niveles compatibles con celulares
    const master = out('master-4k.mp4');
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', master], { stdio: ['pipe', 'inherit', 'inherit'] });
    const n = Math.round((await page.evaluate(() => window.DURATION)) * FPS);
    for (let i = 0; i < n; i++) {
      await page.evaluate(t => seek(t), i / FPS);
      const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 90 === 0) console.log(`cuadro ${i}/${n}`);
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
    // nivel 4.1/5.1, GOP de 2 s y pista de audio muda: se reproducen fluido en celulares y en Instagram/WhatsApp
    const common = '-pix_fmt yuv420p -profile:v high -preset medium -bf 2 -refs 3 -g 60 -keyint_min 30 -sc_threshold 0 -tag:v avc1 -c:a aac -b:a 128k -ar 48000 -shortest -movflags +faststart';
    const enc = (vf, crf, max, level, name) => execSync(`ffmpeg -y -loglevel error -i ${master} -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=48000 -map 0:v -map 1:a ${vf} -c:v libx264 -crf ${crf} -maxrate ${max} -bufsize ${parseInt(max) * 2}M -level ${level} ${common} ${out(name)}`);
    enc('', 18, '30M', '5.1', 'julian-acebal-reel-4k.mp4');
    enc('-vf scale=1080:1920:flags=lanczos', 18, '10M', '4.1', 'julian-acebal-reel-1080.mp4');
    enc('-vf scale=1080:1920:flags=lanczos', 23, '5M', '4.1', 'julian-acebal-reel-whatsapp.mp4');
    fs.rmSync(master, { force: true });
  }
  await browser.close();
})();
