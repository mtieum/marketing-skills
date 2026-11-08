// Downloads a Google Fonts family as one woff2 for the brand kit (the variable font where there is one):
//   node tools/google-font.mjs "Inter" brand/fonts/text.woff2
// Google Fonts are under the SIL Open Font License or Apache 2.0: free for commercial use and video.
import { writeFileSync } from 'node:fs';

const [family, out] = process.argv.slice(2);
if (!family || !out) { console.error('usage: node tools/google-font.mjs "<Family>" <out.woff2>'); process.exit(1); }
const q = encodeURIComponent(family).replace(/%20/g, '+');
// Ask for the full weight range first (variable), then the common static weights.
const tries = [`${q}:wght@100..900`, `${q}:wght@200..800`, `${q}:wght@300..700`, `${q}:wght@400;700`, q];
let css = '';
for (const t of tries) {
  const r = await fetch(`https://fonts.googleapis.com/css2?family=${t}&display=swap`, {
    // A modern browser's agent, or Google sends TTF instead of woff2.
    headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' },
  });
  if (r.ok) { css = await r.text(); break; }
}
if (!css) { console.error(`"${family}" not found on Google Fonts`); process.exit(1); }
// The latin block (the last @font-face is latin in Google's ordering).
const blocks = css.split('@font-face').filter((b) => b.includes('src:'));
const latin = blocks.find((b) => /U\+0000-00FF/.test(b)) ?? blocks[blocks.length - 1];
const url = latin.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
if (!url) { console.error('no woff2 in the response'); process.exit(1); }
writeFileSync(out, Buffer.from(await (await fetch(url)).arrayBuffer()));
const weight = latin.match(/font-weight:\s*([^;]+);/)?.[1];
console.log(`saved ${out} (${family}, weight ${weight}, latin)`);
if (weight && !weight.includes(' ')) console.log('note: a single static weight; titles use 800 and captions 700, so a variable font or the bold weight looks better');
