// Checks a short before it renders: every file it names is there, every picture has its credit,
// and (unless --draft) every line has its voice.
//   node tools/check.mjs <slug> [--draft]
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { MEDIA, readShort } from './lib.mjs';

const [slug, flag] = process.argv.slice(2);
if (!slug) { console.error('usage: node tools/check.mjs <slug> [--draft]'); process.exit(1); }
const short = readShort(slug);
const draft = flag === '--draft';
const problems = [];
if (short.slug !== slug) problems.push(`slug in the file is "${short.slug}", expected "${slug}"`);
if (!/^https?:\/\//.test(short.link ?? '')) problems.push('link: needs the full URL the short sends people to');
short.sections.forEach((s, i) => {
  const at = `section ${i + 1}`;
  if (!s.vo?.trim()) problems.push(`${at}: no voice-over line`);
  if (!s.shots?.length) problems.push(`${at}: no shots`);
  if (!draft && !s.voice) problems.push(`${at}: no voice yet (make it with the shorts:voice skill, or build with --draft)`);
  if (s.voice && !existsSync(join(MEDIA, s.voice))) problems.push(`${at}: voice ${s.voice} not found`);
  for (const shot of s.shots ?? []) {
    for (const src of [shot.src, shot.backdrop].filter(Boolean)) {
      if (!existsSync(join(MEDIA, src))) problems.push(`${at}: ${src} not found in the media folder`);
    }
    if (['clip', 'photo', 'screen'].includes(shot.kind) && !shot.own && !shot.credit?.trim()) {
      problems.push(`${at}: ${shot.src} has no credit (say who made it and the licence, or "own": true for your own)`);
    }
  }
});
if (!short.sections.some((s) => s.end)) problems.push('no closing section ("end": true)');
for (const p of problems) console.log(`- ${p}`);
if (problems.length) { console.log(`${slug}: ${problems.length} problem(s)`); process.exit(1); }
console.log(`${slug}: ok${draft ? ' (draft)' : ''}`);
