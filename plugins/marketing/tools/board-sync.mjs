#!/usr/bin/env node
// Syncs a workspace's queue with its hosted review board (board-cloud/):
//   node board-sync.mjs [workspace]          # defaults to ./marketing
//   node board-sync.mjs marketing --test-push   # also send a test notification to every device
//
// 1. Takes the decisions made on the hosted board (approve, change, reject, posted) and writes
//    them into the item files, exactly as the local board does.
// 2. Uploads the queue (text, front matter, fact checks) and any files not uploaded yet
//    (videos go up in parts; unchanged files are skipped). Files no item names any more are
//    deleted from the bucket.
// Reads BOARD_URL and BOARD_SYNC_TOKEN from <workspace>/.board.env (written by board-cloud/setup.mjs)
// or the environment. Safe to run as often as you like.
import { createHash } from 'node:crypto';
import { closeSync, existsSync, openSync, readFileSync, readSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { decisionChanges, items, setMeta, verification } from './queue-lib.mjs';

const args = process.argv.slice(2);
const ws = resolve(args.find((a) => !a.startsWith('--')) ?? 'marketing');
const envFile = join(ws, '.board.env');
const fileEnv = existsSync(envFile) ? Object.fromEntries(readFileSync(envFile, 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])) : {};
const URL_ = (process.env.BOARD_URL ?? fileEnv.BOARD_URL ?? '').replace(/\/$/, '');
const TOKEN = process.env.BOARD_SYNC_TOKEN ?? fileEnv.BOARD_SYNC_TOKEN;
if (!URL_ || !TOKEN) { console.error(`No hosted board for ${ws}: run board-cloud/setup.mjs first (it writes ${envFile}).`); process.exit(1); }

const api = async (method, path, body, headers = {}) => {
  const r = await fetch(`${URL_}${path}`, { method, body, headers: { authorization: `Bearer ${TOKEN}`, ...headers } });
  if (!r.ok && r.status !== 404) throw new Error(`${method} ${path}: ${r.status} ${await r.text()}`);
  return r;
};
const TYPES = { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };

// --- 1. Decisions down -----------------------------------------------------
const decisions = await (await api('GET', '/api/sync/decisions')).json();
const known = new Set(items(ws).map((i) => i.file));
const applied = [];
for (const d of decisions.sort((a, b) => a.at.localeCompare(b.at))) {
  if (!known.has(d.file)) { console.log(`skip decision for ${d.file}: no longer in the queue`); applied.push({ key: d.key, at: d.at }); continue; }
  setMeta(ws, d.file, decisionChanges(d));
  console.log(`${d.status.padEnd(9)} ${d.file}${d.note ? `  "${d.note}"` : ''}${d.out_url ? `  ${d.out_url}` : ''}`);
  applied.push({ key: d.key, at: d.at });
}

// --- 2. Files up -----------------------------------------------------------
const all = items(ws);
let uploaded = 0;
for (const it of all) {
  it.assetKeys = {};
  for (const p of [].concat(it.meta.assets ?? [])) {
    const ext = extname(p).toLowerCase();
    if (!TYPES[ext] || !existsSync(p)) continue; // only media; captions etc. stay local
    const st = statSync(p);
    const key = `a/${createHash('sha1').update(`${p}|${st.size}|${Math.round(st.mtimeMs)}`).digest('hex').slice(0, 24)}${ext}`;
    it.assetKeys[p] = key;
    if ((await api('GET', `/api/sync/asset?key=${encodeURIComponent(key)}`)).ok) continue;
    const { uploadId, partSize } = await (await api('POST', `/api/sync/upload?key=${encodeURIComponent(key)}&type=${encodeURIComponent(TYPES[ext])}`)).json();
    const fd = openSync(p, 'r');
    const parts = [];
    try {
      for (let n = 1, off = 0; off < st.size; n++, off += partSize) {
        const buf = Buffer.alloc(Math.min(partSize, st.size - off));
        readSync(fd, buf, 0, buf.length, off);
        process.stdout.write(`\rupload ${p.split('/').pop()}  ${Math.round(((off + buf.length) / st.size) * 100)}%   `);
        parts.push(await (await api('PUT', `/api/sync/upload?key=${encodeURIComponent(key)}&uploadId=${encodeURIComponent(uploadId)}&part=${n}`, buf)).json());
      }
    } finally { closeSync(fd); }
    await api('POST', `/api/sync/complete?key=${encodeURIComponent(key)}`, JSON.stringify({ uploadId, parts }), { 'content-type': 'application/json' });
    process.stdout.write('\n');
    uploaded++;
  }
}

// --- 3. Queue up, then clear the decisions now in the files ------------------
// Which channels post through a gateway (publish.json), and where the board lives (for its signed links).
const publishFile = join(ws, 'publish.json');
const publish = existsSync(publishFile) ? JSON.parse(readFileSync(publishFile, 'utf8')) : null;
const payload = { origin: URL_, publish, items: all.map(({ file, meta, text, assetKeys }) => ({ file, meta, text, assetKeys, verification: verification(ws, { meta, file }) })) };
const res = await (await api('PUT', '/api/sync/queue', JSON.stringify(payload), { 'content-type': 'application/json' })).json();
if (applied.length) await api('POST', '/api/sync/ack', JSON.stringify({ done: applied }), { 'content-type': 'application/json' });
console.log(`synced ${res.items} items to ${URL_}: ${applied.length} decision(s) in, ${uploaded} file(s) uploaded, ${res.removed} old file(s) removed`);

if (args.includes('--test-push')) {
  const { sent } = await (await api('POST', '/api/sync/test-push')).json();
  console.log(`test notification sent to ${sent} device(s)`);
}
