import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decisionChanges, setMeta } from './queue-lib.mjs';

const workspace = (fm) => {
  const ws = mkdtempSync(join(tmpdir(), 'queue-'));
  mkdirSync(join(ws, 'queue'));
  writeFileSync(join(ws, 'queue', 'a.md'), `---\n${fm}\n---\nThe caption.\n`);
  return ws;
};
const read = (ws) => readFileSync(join(ws, 'queue', 'a.md'), 'utf8');

test('Edit link: a posted item gets its new link and keeps the day it went out', () => {
  const ws = workspace('channel: pinterest\nstatus: out\nout: 2026-11-15\nout_url: https://www.tiktok.com/@x/video/1');
  setMeta(ws, 'a.md', decisionChanges({ status: 'out', relink: true, out_url: 'https://www.pinterest.com/pin/123/', at: '2026-11-16T09:00:00Z' }));
  const text = read(ws);
  assert.match(text, /^out_url: "https:\/\/www\.pinterest\.com\/pin\/123\/"$/m);
  assert.match(text, /^out: 2026-11-15$/m);
  assert.match(text, /\nThe caption\.\n$/);
});

test('Not posted: back to approved, the link and day gone, marked unposted', () => {
  const ws = workspace('channel: pinterest\nstatus: out\nout: 2026-11-15\nout_url: https://example.com/p\ndue: 2026-11-15');
  setMeta(ws, 'a.md', decisionChanges({ status: 'approved', unpost: true, at: '2026-11-15T21:00:00.000Z' }));
  const text = read(ws);
  assert.match(text, /^status: approved$/m);
  assert.doesNotMatch(text, /^out(_url)?:/m);
  assert.match(text, /^due: 2026-11-15$/m);
  assert.match(text, /^unposted: "2026-11-15T21:00:00\.000Z"$/m);
  assert.match(text, /^---\n[\s\S]*\n---\nThe caption\.\n$/);
});

test('an ordinary Posted still records the day', () => {
  assert.deepEqual(decisionChanges({ status: 'out', out_url: 'https://example.com/p', at: '2026-11-15T10:00:00Z' }), { status: 'out', decided: '2026-11-15', out_url: 'https://example.com/p', out: '2026-11-15' });
});
