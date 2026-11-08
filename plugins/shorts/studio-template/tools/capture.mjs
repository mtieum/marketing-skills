// A phone-sized, full-page screenshot of a live page, for a short's screen shot:
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
await page.waitForTimeout(1500);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(`saved ${out}`);
