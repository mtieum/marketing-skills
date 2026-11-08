// Channel art from the brand kit: <media>/_channel/avatar.png (800x800: the icon on the background,
// inside the apps' circle crop) and youtube-banner.png (2560x1440: the logo and a line inside the
// 1546x423 middle every device shows).
//   node tools/channel.mjs ["The line under the logo"]
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { MEDIA } from './lib.mjs';

const kit = JSON.parse(readFileSync(new URL('../src/generated/brand.json', import.meta.url), 'utf8'));
const line = process.argv[2] ?? '';
const out = join(MEDIA, '_channel');
mkdirSync(out, { recursive: true });
const file = (p) => pathToFileURL(join(MEDIA, p)).href;
const c = kit.colours;
const base = `
  @font-face { font-family: 'Brand Text'; src: url(${file(kit.fonts.text)}); font-weight: 100 900; }
  * { margin: 0; box-sizing: border-box; } body { background: ${c.background}; overflow: hidden; }`;
const icon = kit.logo.icon ?? kit.logo.onDark;
const avatar = `<!doctype html><style>${base}</style>
<div style="width:800px;height:800px;display:flex;align-items:center;justify-content:center;background:${c.background}">
  <img src="${file(icon)}" style="width:520px;height:520px;object-fit:contain">
</div>`;
const banner = `<!doctype html><style>${base}</style>
<div style="position:absolute;inset:0;width:2560px;height:1440px;background:radial-gradient(ellipse 70% 60% at 50% 50%, ${c.surface} 0%, ${c.background} 70%)">
  <div style="position:absolute;left:507px;top:508px;width:1546px;height:423px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px">
    <img src="${file(kit.logo.onDark)}" style="max-width:860px;max-height:220px;object-fit:contain">
    ${line ? `<div style="font-family:'Brand Text';font-weight:600;font-size:50px;color:${c.text}">${line}</div>` : ''}
  </div>
</div>`;
const browser = await chromium.launch();
for (const [name, html, w, h] of [['avatar', avatar, 800, 800], ['youtube-banner', banner, 2560, 1440]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  // Opened from a file, not set as content: only a file:// page may load the fonts and logo from disk.
  const tmp = join(out, `${name}.html`);
  writeFileSync(tmp, html);
  await page.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(out, `${name}.png`) });
  await page.close();
  rmSync(tmp);
  console.log(`saved ${join(out, `${name}.png`)}`);
}
await browser.close();
