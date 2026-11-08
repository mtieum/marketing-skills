#!/usr/bin/env node
// The review board: every queue item on one page in the browser, with its video or image,
// the exact text (one click to copy), the link, the fact check, and buttons for the owner's
// decision, which are written straight back into the item's front matter.
//
//   node board.mjs [workspace]      # workspace defaults to ./marketing; opens http://localhost:4747
//   PORT=5000 node board.mjs marketing
//
// No dependencies. It listens on 127.0.0.1 only, and serves only the files the queue items
// name as assets. Nothing is posted anywhere: "Posted" only records that the owner did it.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { ALLOWED_STATUS, decisionChanges, items as readItems, setMeta, verification } from './queue-lib.mjs';
import { calendar, page } from './board-page.mjs';

const WS = resolve(process.argv[2] ?? 'marketing');
const QUEUE = join(WS, 'queue');
const items = () => readItems(WS).map((it) => ({ ...it, verification: verification(WS, it) }));
const PORT = Number(process.env.PORT ?? 4747);
if (!existsSync(QUEUE)) {
  console.error(`no queue at ${QUEUE}: pass the workspace folder (the one with brand.md and queue/)`);
  process.exit(1);
}

// --- Server ----------------------------------------------------------------
const TYPES = { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.srt': 'text/plain; charset=utf-8', '.csv': 'text/plain; charset=utf-8' };

function sendAsset(req, res, p) {
  // Only files a queue item names: the board is not a general file server.
  const known = items().some((i) => [].concat(i.meta.assets ?? []).includes(p));
  if (!known || !existsSync(p)) { res.writeHead(404).end('not an asset of any queue item'); return; }
  const size = statSync(p).size;
  const type = TYPES[extname(p).toLowerCase()] ?? 'application/octet-stream';
  const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    const start = range[1] ? Number(range[1]) : size - Number(range[2]);
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    res.writeHead(206, { 'content-type': type, 'content-range': `bytes ${start}-${end}/${size}`, 'accept-ranges': 'bytes', 'content-length': end - start + 1 });
    createReadStream(p, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { 'content-type': type, 'accept-ranges': 'bytes', 'content-length': size });
    createReadStream(p).pipe(res);
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(page(items()));
    } else if (req.method === 'GET' && url.pathname === '/reminders.ics') {
      res.writeHead(200, { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': 'attachment; filename="posts-to-do.ics"', 'cache-control': 'no-store' }).end(calendar(items(), `http://localhost:${PORT}`));
    } else if (req.method === 'GET' && url.pathname === '/asset') {
      sendAsset(req, res, url.searchParams.get('p') ?? '');
    } else if (req.method === 'POST' && url.pathname === '/decide') {
      // Same-origin only: a page elsewhere can't change the queue through this.
      const origin = req.headers.origin;
      if (origin && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) { res.writeHead(403).end('wrong origin'); return; }
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const { file, status, note, out_url } = JSON.parse(body);
          if (!ALLOWED_STATUS.has(status)) throw new Error('unknown status');
          if (!items().some((i) => i.file === file)) throw new Error('unknown item');
          setMeta(WS, file, decisionChanges({ status, note, out_url }));
          res.writeHead(200).end('ok');
        } catch (e) {
          res.writeHead(400).end(e.message);
        }
      });
    } else res.writeHead(404).end('not found');
  } catch (e) {
    res.writeHead(500).end(String(e?.message ?? e));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  const link = `http://localhost:${PORT}/`;
  console.log(`review board for ${WS}\n  ${link}\n  (Ctrl+C to stop)`);
  if (!process.env.NO_OPEN) {
    const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open';
    execFile(opener, [link], () => {});
  }
});
