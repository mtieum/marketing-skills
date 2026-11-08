// Writes <media>/<slug>/upload/captions.srt from the spoken lines, timed as src/timing.ts times them:
// each section is its line's length plus TAIL (plus END_HOLD for the close), rounded up to a frame.
//   node tools/captions.mjs <slug>
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MEDIA, readShort } from './lib.mjs';

const FPS = 30, TAIL = 0.3, END_HOLD = 0.8;
const slug = process.argv[2];
const short = readShort(slug);
const stamp = (s) => {
  const ms = Math.round(s * 1000);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
let at = 0;
const out = short.sections.map((s, n) => {
  const spoken = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', join(MEDIA, s.voice)]).toString());
  const block = `${n + 1}\n${stamp(at / FPS)} --> ${stamp((at + Math.round(spoken * FPS)) / FPS)}\n${s.vo}\n`;
  at += Math.ceil((spoken + TAIL + (s.end ? END_HOLD : 0)) * FPS);
  return block;
});
mkdirSync(join(MEDIA, slug, 'upload'), { recursive: true });
writeFileSync(join(MEDIA, slug, 'upload', 'captions.srt'), out.join('\n'));
console.log(`captions: ${join(MEDIA, slug, 'upload', 'captions.srt')}`);
