// Lists the shorts in shorts/*.json for the renderer: writes src/generated/shorts.ts.
//   node tools/index.mjs
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, SHORTS } from './lib.mjs';

const files = existsSync(SHORTS) ? readdirSync(SHORTS).filter((f) => f.endsWith('.json')).sort() : [];
const id = (f, i) => `s${i}`;
const lines = [
  "// Written by tools/index.mjs: don't edit.",
  "import type { ShortSpec } from '../types';",
  ...files.map((f, i) => `import ${id(f, i)} from '../../shorts/${f}';`),
  `export const shorts = [${files.map(id).join(', ')}] as ShortSpec[];`,
  '',
];
mkdirSync(join(ROOT, 'src/generated'), { recursive: true });
writeFileSync(join(ROOT, 'src/generated/shorts.ts'), lines.join('\n'));
console.log(`${files.length} short(s): ${files.map((f) => f.replace(/\.json$/, '')).join(', ') || 'none yet'}`);
