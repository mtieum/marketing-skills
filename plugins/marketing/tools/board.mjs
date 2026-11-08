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
import { createReadStream, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { execFile } from 'node:child_process';

const WS = resolve(process.argv[2] ?? 'marketing');
const QUEUE = join(WS, 'queue');
const PORT = Number(process.env.PORT ?? 4747);
if (!existsSync(QUEUE)) {
  console.error(`no queue at ${QUEUE}: pass the workspace folder (the one with brand.md and queue/)`);
  process.exit(1);
}

// --- Items -----------------------------------------------------------------
const FM = /^---\n([\s\S]*?)\n---\n?/;
function parse(file) {
  const raw = readFileSync(join(QUEUE, file), 'utf8');
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
const items = () => readdirSync(QUEUE).filter((f) => f.endsWith('.md') && f !== 'README.md').map(parse)
  .sort((a, b) => `${a.meta.due ?? '9'} ${a.meta.time ?? ''} ${a.file}`.localeCompare(`${b.meta.due ?? '9'} ${b.meta.time ?? ''} ${b.file}`));

/** Set (or add) front-matter keys in an item file, leaving everything else as written. */
function setMeta(file, changes) {
  const path = join(QUEUE, file);
  let raw = readFileSync(path, 'utf8');
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

const verification = (item) => {
  // An item whose text is another's (the same caption on a second channel) can point at its check.
  const id = item.meta.checked_as ?? item.meta.id ?? item.file.replace(/\.md$/, '');
  const f = join(WS, 'campaigns', item.meta.campaign ?? '', 'verification', `${id}.md`);
  return existsSync(f) ? readFileSync(f, 'utf8') : null;
};

// --- Page ------------------------------------------------------------------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const VIDEO = new Set(['.mp4', '.mov', '.webm']);
const IMAGE = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const assetUrl = (p) => `/asset?p=${encodeURIComponent(p)}`;

/** A markdown table as an HTML table; other lines as paragraphs. Enough for verification files. */
function mdLite(md) {
  const out = [];
  let rows = [];
  const flush = () => {
    if (!rows.length) return;
    const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    const [head, , ...rest] = rows;
    out.push(`<table><tr>${cells(head).map((c) => `<th>${esc(c)}</th>`).join('')}</tr>${rest.map((r) => `<tr>${cells(r).map((c) => `<td class="v-${esc(c.toLowerCase())}">${esc(c)}</td>`).join('')}</tr>`).join('')}</table>`);
    rows = [];
  };
  for (const line of md.split('\n')) {
    if (line.startsWith('|')) { rows.push(line); continue; }
    flush();
    if (/^#+\s/.test(line)) out.push(`<h4>${esc(line.replace(/^#+\s/, ''))}</h4>`);
    else if (line.trim()) out.push(`<p>${esc(line)}</p>`);
  }
  flush();
  return out.join('');
}

function verdicts(md, status) {
  if (!md) return '<span class="tag warn">not checked</span>';
  const n = (v) => (md.match(new RegExp(`\\|\\s*${v}\\s*\\|`, 'g')) ?? []).length;
  const bad = n('WRONG') + n('UNSUPPORTED');
  // Past draft, the fact gate has applied its fixes: the rows are history, not work left.
  const fixed = bad && status && status !== 'draft';
  return `<span class="tag ${bad && !fixed ? 'bad' : 'good'}">${n('SUPPORTED')} supported${bad ? `, ${bad} ${fixed ? 'fixed' : 'to fix'}` : ''}</span>`;
}

/** The text to paste: fenced blocks if the item has them (several fields), else the whole text. */
function copyBlocks(text) {
  const fences = [...text.matchAll(/(?:^|\n)([^\n]*)\n```[^\n]*\n([\s\S]*?)\n```/g)];
  if (fences.length) return fences.map(([, label, body]) => ({ label: label.replace(/[:#*]/g, '').trim(), body }));
  return [{ label: '', body: text }];
}

function card(item, n) {
  const { meta } = item;
  const assets = [].concat(meta.assets ?? []);
  const media = assets.map((p) => {
    const e = extname(p).toLowerCase();
    if (VIDEO.has(e)) return `<video controls preload="metadata" src="${assetUrl(p)}"></video>`;
    if (IMAGE.has(e)) return `<img src="${assetUrl(p)}" alt="">`;
    return '';
  }).join('');
  const files = assets.map((p) => `<li><code>${esc(p)}</code> <button class="ghost" data-copy="${esc(p)}">Copy path</button></li>`).join('');
  const v = verification(item);
  const blocks = copyBlocks(item.text).map((b, i) => `
    <div class="block">
      <div class="block-head"><span>${esc(b.label || 'Text to paste')}</span><button data-copyblock>Copy</button></div>
      <pre>${esc(b.body)}</pre>
    </div>`).join('');
  return `
  <article class="card" data-status="${esc(meta.status)}" data-channel="${esc(meta.channel)}" data-file="${esc(item.file)}">
    <header>
      <span class="n">${n}</span>
      <span class="chan">${esc(meta.channel ?? '?')}</span>
      <span class="when">${esc(meta.due ?? '')} ${esc(meta.time ?? '')}</span>
      <span class="status s-${esc(meta.status)}">${esc(meta.status ?? 'draft')}</span>
      ${verdicts(v, meta.status)}
      <span class="id">${esc(meta.id ?? item.file)}</span>
    </header>
    <div class="body">
      ${media ? `<div class="media">${media}</div>` : ''}
      <div class="words">
        ${blocks}
        ${meta.link ? `<p class="row"><b>Link</b> <a href="${esc(meta.link)}" target="_blank" rel="noopener">${esc(meta.link)}</a> <button class="ghost" data-copy="${esc(meta.link)}">Copy</button></p>` : ''}
        ${meta.notes ? `<p class="row notes"><b>Notes</b> ${esc(meta.notes)}</p>` : ''}
        ${meta.owner_note ? `<p class="row notes"><b>Your note</b> ${esc(meta.owner_note)}</p>` : ''}
        ${meta.out_url ? `<p class="row"><b>Posted</b> <a href="${esc(meta.out_url)}" target="_blank" rel="noopener">${esc(meta.out_url)}</a></p>` : ''}
        ${files ? `<details><summary>Files</summary><ul class="files">${files}</ul></details>` : ''}
        ${v ? `<details><summary>Fact check</summary><div class="check">${mdLite(v)}</div></details>` : ''}
        <div class="actions">
          <button data-act="approved" class="yes">Approve</button>
          <button data-act="changes">Change…</button>
          <button data-act="rejected" class="no">Reject</button>
          <button data-act="out">Posted…</button>
        </div>
      </div>
    </div>
  </article>`;
}

function page() {
  const all = items();
  const statuses = [...new Set(all.map((i) => i.meta.status ?? 'draft'))];
  const channels = [...new Set(all.map((i) => i.meta.channel ?? '?'))];
  let lastDay = '';
  const cards = all.map((it, i) => {
    const day = it.meta.due ?? 'No date';
    const head = day !== lastDay ? `<h2 class="day">${esc(new Date(`${day}T12:00`).toString() === 'Invalid Date' ? day : new Date(`${day}T12:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }))}</h2>` : '';
    lastDay = day;
    return head + card(it, i + 1);
  }).join('');
  const chip = (kind, v) => `<label class="chip"><input type="checkbox" data-filter="${kind}" value="${esc(v)}" checked> ${esc(v)}</label>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Review board</title>
<style>
:root{--bg:#f6f6f4;--card:#fff;--ink:#1c1c1a;--muted:#6b6b66;--line:#e2e2dc;--accent:#2f5bd3;--good:#1f7a3f;--bad:#b3261e;--warn:#9a6700;--code:#f0f0ec}
@media (prefers-color-scheme:dark){:root{--bg:#141413;--card:#1e1e1c;--ink:#ecece8;--muted:#a3a39c;--line:#33332f;--accent:#8aa8ff;--good:#6fcf8f;--bad:#ff8a80;--warn:#e6b450;--code:#262623}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,sans-serif}
.top{position:sticky;top:0;z-index:2;background:var(--bg);border-bottom:1px solid var(--line);padding:12px 16px;display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center}
.top h1{font-size:17px;margin:0 8px 0 0}.chip{font-size:13px;color:var(--muted);white-space:nowrap}
main{max-width:1100px;margin:0 auto;padding:8px 16px 80px}
.day{font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:28px 0 8px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;margin:10px 0;overflow:hidden}
.card header{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 14px;border-bottom:1px solid var(--line);font-size:13px}
.n{font-weight:700}.chan{font-weight:600;text-transform:capitalize}.when{color:var(--muted)}.id{color:var(--muted);margin-left:auto;font-family:ui-monospace,monospace;font-size:12px}
.status,.tag{border-radius:99px;padding:1px 9px;border:1px solid currentColor;font-size:12px}
.s-approved,.s-ready,.s-out,.s-measured,.good{color:var(--good)}.s-rejected,.bad{color:var(--bad)}.s-changes,.s-draft,.warn{color:var(--warn)}.s-checked{color:var(--accent)}
.body{display:flex;gap:16px;padding:14px;flex-wrap:wrap}.media{flex:0 0 240px;display:flex;flex-direction:column;gap:8px}
.media video,.media img{width:240px;max-height:430px;border-radius:8px;background:#000}
.words{flex:1 1 380px;min-width:0}
.block{border:1px solid var(--line);border-radius:8px;margin-bottom:10px}.block-head{display:flex;justify-content:space-between;align-items:center;padding:4px 6px 4px 10px;font-size:12px;color:var(--muted);border-bottom:1px solid var(--line)}
pre{margin:0;padding:10px;white-space:pre-wrap;word-break:break-word;font:14px/1.5 system-ui,sans-serif}
.row{margin:6px 0;font-size:14px;word-break:break-word}.row b{color:var(--muted);font-weight:600;margin-right:6px}
a{color:var(--accent)}code{background:var(--code);padding:1px 5px;border-radius:4px;font-size:12px;word-break:break-all}
details{margin:8px 0;font-size:14px}summary{cursor:pointer;color:var(--muted)}.files{padding-left:18px}
.check{overflow-x:auto}table{border-collapse:collapse;font-size:12.5px;margin-top:6px}th,td{border:1px solid var(--line);padding:4px 6px;text-align:left;vertical-align:top}
.v-supported{color:var(--good)}.v-wrong,.v-unsupported{color:var(--bad);font-weight:600}.v-soft{color:var(--warn)}
button{font:inherit;font-size:13px;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:7px;padding:4px 10px;cursor:pointer}
button:hover{border-color:var(--accent)}button.ghost{padding:1px 7px;font-size:12px}
.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.yes{color:var(--good);border-color:currentColor}.no{color:var(--bad)}
.hide{display:none}.toast{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:var(--ink);color:var(--bg);padding:6px 14px;border-radius:8px;opacity:0;transition:opacity .2s}.toast.on{opacity:1}
@media (max-width:600px){.media{flex-basis:100%}.media video,.media img{width:100%}.id{margin-left:0}}
</style></head><body>
<div class="top"><h1>Review board</h1><span class="chip"><b>${all.length}</b> items</span>
${statuses.map((s) => chip('status', s)).join('')}<span class="chip">|</span>${channels.map((c) => chip('channel', c)).join('')}
<button id="reload" class="ghost">Reload</button></div>
<main>${cards || '<p>The queue is empty.</p>'}</main>
<div class="toast" id="toast"></div>
<script>
const toast=(t)=>{const e=document.getElementById('toast');e.textContent=t;e.classList.add('on');setTimeout(()=>e.classList.remove('on'),1400)};
const copy=async(t)=>{try{await navigator.clipboard.writeText(t);toast('Copied')}catch{toast('Copy failed: select and copy by hand')}};
document.addEventListener('click',async(e)=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.id==='reload')return location.reload();
  if(b.dataset.copy!==undefined)return copy(b.dataset.copy);
  if(b.hasAttribute('data-copyblock'))return copy(b.closest('.block').querySelector('pre').textContent);
  const act=b.dataset.act;if(!act)return;
  const card=b.closest('.card');const body={file:card.dataset.file,status:act};
  if(act==='changes'){const n=prompt('What should change?');if(!n)return;body.note=n}
  if(act==='rejected'){const n=prompt('Why? (optional, helps next time)');if(n===null)return;if(n)body.note=n}
  if(act==='out'){const n=prompt('Link to the live post (optional)');if(n===null)return;if(n)body.out_url=n}
  const r=await fetch('/decide',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok)return toast('Not saved: '+(await r.text()));
  const s=card.querySelector('.status');s.textContent=act;s.className='status s-'+act;card.dataset.status=act;toast('Saved: '+act);
});
const filt=()=>{const on=(k)=>[...document.querySelectorAll('[data-filter='+k+']:checked')].map(i=>i.value);
  const st=on('status'),ch=on('channel');document.querySelectorAll('.card').forEach(c=>c.classList.toggle('hide',!(st.includes(c.dataset.status||'draft')&&ch.includes(c.dataset.channel||'?'))))};
document.querySelectorAll('[data-filter]').forEach(i=>i.addEventListener('change',filt));
</script></body></html>`;
}

// --- Server ----------------------------------------------------------------
const TYPES = { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.srt': 'text/plain; charset=utf-8', '.csv': 'text/plain; charset=utf-8' };
const ALLOWED_STATUS = new Set(['approved', 'rejected', 'changes', 'out']);

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
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(page());
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
          const today = new Date().toISOString().slice(0, 10);
          const changes = { status, decided: today };
          if (note) changes.owner_note = String(note).replace(/\n/g, ' ');
          if (out_url) changes.out_url = String(out_url);
          if (status === 'out') changes.out = today;
          setMeta(file, changes);
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
