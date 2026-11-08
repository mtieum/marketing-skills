// The queue's files, shared by the review board, its sync and anything else that reads them.
// An item is queue/<id>.md: front matter (simple `key: value` lines, `[a, b]` lists), the text,
// and optionally `<!-- sources -->` and notes on where the text came from.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const FM = /^---\n([\s\S]*?)\n---\n?/;

/** Statuses that need nothing more from anyone. */
export const DONE = new Set(['out', 'rejected', 'measured']);

export function parse(queue, file) {
  const raw = readFileSync(join(queue, file), 'utf8');
  const m = raw.match(FM);
  const meta = {};
  if (m) for (const line of m[1].split('\n')) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (/^\[.*\]$/.test(v)) v = v.slice(1, -1).split(',').map((s) => s.trim().replace(/^"|"$/g, '')).filter(Boolean);
    else v = v.replace(/^"(.*)"$/, '$1');
    meta[kv[1]] = v;
  }
  const body = m ? raw.slice(m[0].length) : raw;
  const [text, sources = ''] = body.split('<!-- sources -->');
  return { file, meta, text: text.trim(), sources: sources.trim() };
}

/** Every item in a workspace's queue/, in posting order (due date, then time). */
export function items(ws) {
  const queue = join(ws, 'queue');
  return readdirSync(queue).filter((f) => f.endsWith('.md') && f !== 'README.md').map((f) => parse(queue, f))
    .sort((a, b) => `${a.meta.due ?? '9'} ${a.meta.time ?? ''} ${a.file}`.localeCompare(`${b.meta.due ?? '9'} ${b.meta.time ?? ''} ${b.file}`));
}

export const idOf = (item) => item.meta.id ?? item.file.replace(/\.md$/, '');

/** Set (or add) front-matter keys in an item file, leaving everything else as written. */
export function setMeta(ws, file, changes) {
  if (!/^[\w.-]+\.md$/.test(file)) throw new Error('bad item file name');
  const path = join(ws, 'queue', file);
  const raw = readFileSync(path, 'utf8');
  const m = raw.match(FM);
  if (!m) throw new Error('no front matter');
  let fm = m[1];
  for (const [k, v] of Object.entries(changes)) {
    const line = `${k}: ${/[:#"\[\]]|^\s|\s$/.test(v) ? JSON.stringify(v) : v}`;
    const re = new RegExp(`^${k}:.*$`, 'm');
    fm = re.test(fm) ? fm.replace(re, line) : `${fm}\n${line}`;
  }
  writeFileSync(path, raw.replace(FM, `---\n${fm}\n---\n`));
}

/** The fact-check table for an item: campaigns/<campaign>/verification/<id>.md, or the one
 *  `checked_as` names (an item reusing another's text points at that item's check). */
export function verification(ws, item) {
  const id = item.meta.checked_as ?? idOf(item);
  const f = join(ws, 'campaigns', item.meta.campaign ?? '', 'verification', `${id}.md`);
  return existsSync(f) ? readFileSync(f, 'utf8') : null;
}

/** A decision as front-matter changes: what the board writes, locally or after a sync. */
export function decisionChanges({ status, note, out_url, at }) {
  const day = (at ? new Date(at) : new Date()).toISOString().slice(0, 10);
  const changes = { status, decided: day };
  if (note) changes.owner_note = String(note).replace(/\n/g, ' ');
  if (out_url) changes.out_url = String(out_url);
  if (status === 'out') changes.out = day;
  return changes;
}

export const ALLOWED_STATUS = new Set(['approved', 'rejected', 'changes', 'out']);
