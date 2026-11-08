// The lines to voice, numbered as the voice files will be: prints them and writes <media>/<slug>/voice/lines.txt.
// For voice made by hand or through a connector (Higgsfield): save line NN as <media>/<slug>/voice/raw/NN.mp3,
// then run tools/voice-finish.mjs.
//   node tools/voice-lines.mjs <slug>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MEDIA, readShort } from './lib.mjs';

const slug = process.argv[2];
const short = readShort(slug);
const dir = join(MEDIA, slug, 'voice');
mkdirSync(join(dir, 'raw'), { recursive: true });
const lines = short.sections.map((s, i) => `${String(i).padStart(2, '0')}\t${s.vo}`);
writeFileSync(join(dir, 'lines.txt'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
console.log(`\nraw files go in ${join(dir, 'raw')}/NN.mp3 (or .wav)`);
