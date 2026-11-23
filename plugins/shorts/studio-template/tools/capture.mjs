// A phone-sized screenshot of the top of a live page, for a short's screen shot:
//   node tools/capture.mjs <url> <out.png> [--light]
// iPhone width at 3x, the dark colour scheme unless --light, nothing logged in.
import { chromium } from 'playwright';

const [url, out] = process.argv.slice(2);
if (!url || !out) {
  console.error('usage: node tools/capture.mjs <url> <out.png> [--light]');
  process.exit(1);
}
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, colorScheme: process.argv.includes('--light') ? 'light' : 'dark', isMobile: true, hasTouch: true });
await page.goto(url, { waitUntil: 'networkidle' });
// Lazy images load as they scroll into view: scroll through once, then wait for every picture.
await page.evaluate(async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 600) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 250));
  }
  window.scrollTo(0, 0);
  await Promise.all([...document.images].map((img) => {
    img.loading = 'eager';
    return img.complete && img.naturalWidth ? null : new Promise((r) => { img.onload = img.onerror = r; setTimeout(r, 15000); });
  }));
});
// Then each picture in the captured part, one by one: into view, loaded and decoded.
await page.evaluate(async () => {
  for (const img of [...document.images].filter((i) => i.getBoundingClientRect().top + window.scrollY < 2500)) {
    img.scrollIntoView({ block: 'center' });
    for (let t = 0; t < 60 && !(img.complete && img.naturalWidth); t++) await new Promise((r) => setTimeout(r, 250));
    await img.decode().catch(() => {});
  }
  window.scrollTo(0, 0);
});
await page.waitForTimeout(1500);
// Only the top of the page: the screen shot scrolls less than two screens, and a capture taller
// much over ~9,000 device pixels (3,000 CSS px at 3x) comes out with its photos blank.
const height = await page.evaluate(() => Math.min(document.body.scrollHeight, 2500));
await page.screenshot({ path: out, fullPage: true, clip: { x: 0, y: 0, width: 390, height } });
await browser.close();
console.log(`saved ${out}`);
