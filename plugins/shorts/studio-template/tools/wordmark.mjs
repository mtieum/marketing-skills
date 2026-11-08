// A stand-in wordmark until a designer's logo arrives: the brand's name in its display font, as a
// transparent PNG for a dark background (and a square icon from its first letter).
//   node tools/wordmark.mjs                # brand/logo/wordmark-on-dark.png and brand/logo/icon.png
// Reads the name, colours and display font from brand/brand.json (the font file must exist).
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { BRAND } from './lib.mjs';

const kit = JSON.parse(readFileSync(join(BRAND, 'brand.json'), 'utf8'));
const font = pathToFileURL(join(BRAND, kit.fonts.display)).href;
const c = kit.colours;
mkdirSync(join(BRAND, 'logo'), { recursive: true });
const css = `@font-face { font-family: D; src: url(${font}); font-weight: 100 900; } * { margin: 0 } html, body { background: transparent; }`;
const pages = {
  'wordmark-on-dark': [`<div id="m" style="display:inline-block;padding:20px 30px;font:800 220px/1 D;color:${c.text};letter-spacing:-4px;white-space:nowrap">${kit.name}</div>`, null],
  icon: [`<div id="m" style="width:1024px;height:1024px;border-radius:220px;background:${c.background};display:flex;align-items:center;justify-content:center;font:800 640px/1 D;color:${c.accent}">${[...kit.name][0]}</div>`, 1024],
};
const browser = await chromium.launch();
for (const [name, [html]] of Object.entries(pages)) {
  const page = await browser.newPage({ viewport: { width: 2400, height: 1100 } });
  const tmp = join(BRAND, 'logo', `${name}.html`);
  writeFileSync(tmp, `<!doctype html><style>${css}</style>${html}`);
  await page.goto(pathToFileURL(tmp).href);
  await page.evaluate(() => document.fonts.ready);
  await page.locator('#m').screenshot({ path: join(BRAND, 'logo', `${name}.png`), omitBackground: true });
  rmSync(tmp);
  console.log(`saved brand/logo/${name}.png`);
}
await browser.close();
console.log('set brand.json logo.onDark to "logo/wordmark-on-dark.png" and logo.icon to "logo/icon.png" (stand-ins: replace with the real logo when there is one)');
