// Turns the raw voice lines into the ones the short uses: <media>/<slug>/voice/raw/NN.(mp3|wav) ->
// voice/NN.mp3, sped by studio.json voice.speed (ffmpeg atempo, pitch kept), and sets each section's
// "voice" in shorts/<slug>.json. Lines without a raw file are left as they are.
//   node tools/voice-finish.mjs <slug>
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MEDIA, SHORTS, readShort, studio } from './lib.mjs';

const slug = process.argv[2];
const short = readShort(slug);
const speed = Number(studio.voice?.speed || 1);
const dir = join(MEDIA, slug, 'voice');
let made = 0;
short.sections.forEach((s, i) => {
  const nn = String(i).padStart(2, '0');
  const raw = ['mp3', 'wav'].map((e) => join(dir, 'raw', `${nn}.${e}`)).find(existsSync);
  if (!raw) return;
  const out = join(dir, `${nn}.mp3`);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', raw, ...(speed !== 1 ? ['-filter:a', `atempo=${speed}`] : []), '-ar', '44100', '-b:a', '192k', out]);
  s.voice = `${slug}/voice/${nn}.mp3`;
  made++;
});
writeFileSync(join(SHORTS, `${slug}.json`), JSON.stringify(short, null, 2) + '\n');
const missing = short.sections.filter((s) => !s.voice).length;
console.log(`${made} line(s) finished${speed !== 1 ? ` at ${speed}x` : ''}; ${missing} still without a voice`);
