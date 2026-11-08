// The review board, hosted on the owner's own Cloudflare account: the same page as the local
// board (tools/board-page.mjs), behind a password, installable on a phone, with push reminders
// before each post and a Share button that hands the video to the posting app.
//
// The queue stays in the workspace: tools/board-sync.mjs uploads it (items and their files) and
// takes the decisions made here back into the item files. Storage is one R2 bucket:
//   queue.json            the items as last synced (text, front matter, fact check, file keys)
//   a/<key>               the items' files (videos, images)
//   decisions/<id>.json   decisions made here, waiting for the next sync
//   subs/<hash>.json      push subscriptions (one per phone or browser)
//   notified/<id>         reminders already sent
import { DONE, calendar, page, title } from '../../tools/board-page.mjs';

const LEAD_MIN = 15;
const STATUSES = new Set(['approved', 'rejected', 'changes', 'out']);
const enc = new TextEncoder();

// --- Small helpers ---------------------------------------------------------
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const text = (body, status = 200, headers = {}) => new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8', ...headers } });
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const html = (body) => new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer' } });

async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', k, enc.encode(data)));
}
/** Equal strings, compared in time that doesn't depend on where they differ. */
async function same(a, b) {
  const [x, y] = await Promise.all([a, b].map((s) => crypto.subtle.digest('SHA-256', enc.encode(String(s)))));
  return crypto.subtle.timingSafeEqual ? crypto.subtle.timingSafeEqual(x, y) : b64url(x) === b64url(y);
}

// --- Sign-in: one password, a signed cookie for 90 days ---------------------
const SESSION_DAYS = 90;
const sessionKey = (env) => `${env.SYNC_TOKEN}:${env.BOARD_PASSWORD}`; // a new password signs everyone out
async function signedIn(req, env) {
  const c = req.headers.get('cookie')?.match(/(?:^|;\s*)board=([^;]+)/)?.[1];
  if (!c) return false;
  const [exp, sig] = c.split('.');
  return Number(exp) > Date.now() && (await same(sig, await hmac(sessionKey(env), exp)));
}
async function login(req, env) {
  const form = await req.formData();
  if (!(await same(form.get('password') ?? '', env.BOARD_PASSWORD))) {
    await new Promise((r) => setTimeout(r, 1000));
    return loginPage('Wrong password.');
  }
  const exp = String(Date.now() + SESSION_DAYS * 864e5);
  return new Response(null, {
    status: 303,
    headers: { location: '/', 'set-cookie': `board=${exp}.${await hmac(sessionKey(env), exp)}; Path=/; Max-Age=${SESSION_DAYS * 86400}; HttpOnly; Secure; SameSite=Lax` },
  });
}
const loginPage = (msg = '') => html(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Review board</title><link rel="manifest" href="/manifest.webmanifest"><link rel="icon" href="/icon.svg"><meta name="theme-color" content="#1e1e1c">
<style>:root{color-scheme:light dark}body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px system-ui,sans-serif;background:#141413;color:#ecece8}
form{display:grid;gap:12px;width:min(320px,90vw)}input,button{font:inherit;padding:10px 12px;border-radius:8px;border:1px solid #33332f;background:#1e1e1c;color:inherit}
button{background:#8aa8ff;color:#141413;font-weight:600;border:0}p{color:#ff8a80;margin:0}</style></head><body>
<form method="post" action="/login"><h1 style="font-size:20px;margin:0">Review board</h1>${msg ? `<p>${msg}</p>` : ''}
<input type="password" name="password" placeholder="Password" autocomplete="current-password" required autofocus><button>Sign in</button></form></body></html>`);

// --- The queue -------------------------------------------------------------
async function loadQueue(env) {
  const obj = await env.BUCKET.get('queue.json');
  const q = obj ? await obj.json() : { items: [] };
  // Decisions made here since the last sync, laid over the items so the page shows them now.
  const list = await env.BUCKET.list({ prefix: 'decisions/' });
  const decisions = await Promise.all(list.objects.map(async (o) => (await env.BUCKET.get(o.key))?.json()));
  for (const d of decisions.filter(Boolean)) {
    const it = q.items.find((i) => i.file === d.file);
    if (!it) continue;
    it.meta.status = d.status;
    if (d.note) it.meta.owner_note = d.note;
    if (d.out_url) it.meta.out_url = d.out_url;
  }
  return q;
}
const idOf = (it) => it.meta.id ?? it.file.replace(/\.md$/, '');

/** A wall-clock date and time in a time zone, as a UTC timestamp. */
function zoned(date, time, tz) {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = (time || '09:00').split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, h, mi);
  const offset = (ts) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(ts).map((x) => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - ts;
  };
  let ts = wall - offset(wall);
  ts = wall - offset(ts); // twice, for the hour a clock change moves
  return ts;
}
const dueAt = (it, env) => (it.meta.due ? zoned(it.meta.due, it.meta.time, env.BOARD_TZ || 'UTC') : null);
const todo = (it) => !DONE.has(it.meta.status ?? 'draft');
const needsYes = (it) => ['draft', 'checked', 'changes'].includes(it.meta.status ?? 'draft');

// --- Files (R2), with ranges so videos seek ---------------------------------
async function serveAsset(req, env, url) {
  const q = await loadQueue(env);
  const p = url.searchParams.get('p') ?? '';
  const key = q.items.map((i) => i.assetKeys?.[p]).find(Boolean);
  if (!key) return text('not an asset of any queue item', 404);
  const range = req.headers.get('range')?.match(/bytes=(\d*)-(\d*)/);
  const head = await env.BUCKET.head(key);
  if (!head) return text('not synced yet', 404);
  const size = head.size;
  const type = head.httpMetadata?.contentType ?? 'application/octet-stream';
  const base = { 'content-type': type, 'accept-ranges': 'bytes', 'cache-control': 'private, max-age=86400' };
  if (url.searchParams.has('dl')) base['content-disposition'] = `attachment; filename="${p.split('/').pop().replace(/"/g, '')}"`;
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : size - Number(range[2]);
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    const obj = await env.BUCKET.get(key, { range: { offset: start, length: end - start + 1 } });
    return new Response(obj.body, { status: 206, headers: { ...base, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': String(end - start + 1) } });
  }
  const obj = await env.BUCKET.get(key);
  return new Response(obj.body, { headers: { ...base, 'content-length': String(size) } });
}

// --- Push (Web Push with VAPID, no payload: the phone asks what's due) ------
async function vapidHeader(endpoint, env) {
  const jwk = JSON.parse(env.VAPID_PRIVATE_JWK);
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const head = b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64url(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT || 'mailto:owner@example.com' })));
  const sig = b64url(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${body}`)));
  return `vapid t=${head}.${body}.${sig}, k=${env.VAPID_PUBLIC}`;
}
async function pushAll(env) {
  const list = await env.BUCKET.list({ prefix: 'subs/' });
  let sent = 0;
  for (const o of list.objects) {
    const sub = await (await env.BUCKET.get(o.key))?.json();
    if (!sub?.endpoint) continue;
    try {
      const r = await fetch(sub.endpoint, { method: 'POST', headers: { authorization: await vapidHeader(sub.endpoint, env), ttl: '3600', urgency: 'high', 'content-length': '0' } });
      if (r.status === 404 || r.status === 410) await env.BUCKET.delete(o.key); // the phone dropped it
      else if (r.ok) sent++;
      else console.log('push failed', r.status, await r.text());
    } catch (e) {
      console.log('push failed', e?.message ?? e); // one device's trouble doesn't stop the others
    }
  }
  return sent;
}
/** What the notification says: the next post due, from LEAD_MIN before it to an hour after. */
async function nextUp(env) {
  const q = await loadQueue(env);
  const now = Date.now();
  const due = q.items.filter((i) => todo(i) && dueAt(i, env) !== null && now >= dueAt(i, env) - (LEAD_MIN + 5) * 60000 && now < dueAt(i, env) + 3600000)
    .sort((a, b) => dueAt(a, env) - dueAt(b, env));
  if (!due.length) return { title: 'Review board', body: 'Nothing due right now.', url: '/' };
  const it = due[0];
  const more = due.length > 1 ? ` (+${due.length - 1} more)` : '';
  return {
    title: `Post at ${it.meta.time ?? ''}: ${title(it)}${more}`,
    body: needsYes(it) ? 'Still needs your approval. Tap to open.' : 'Tap to open, then Share to app.',
    url: `/#${idOf(it)}`, tag: idOf(it),
  };
}
async function remind(env) {
  const q = await loadQueue(env);
  const now = Date.now();
  for (const it of q.items) {
    const at = dueAt(it, env);
    if (!todo(it) || at === null || now < at - LEAD_MIN * 60000 || now > at + 3600000) continue;
    const mark = `notified/${idOf(it)}`;
    if (await env.BUCKET.head(mark)) continue;
    await env.BUCKET.put(mark, String(now));
    console.log('reminder', idOf(it), await pushAll(env));
  }
}

// --- Sync API (bearer token, used by tools/board-sync.mjs) ------------------
const PART = 25 * 1024 * 1024; // R2 multipart: every part but the last the same size
async function syncApi(req, env, url) {
  const auth = req.headers.get('authorization') ?? '';
  if (!(await same(auth, `Bearer ${env.SYNC_TOKEN}`))) return text('bad token', 401);
  const key = url.searchParams.get('key') ?? '';
  if (key && !/^a\/[\w.-]+$/.test(key)) return text('bad key', 400);
  const route = `${req.method} ${url.pathname}`;
  switch (route) {
    case 'GET /api/sync/decisions': {
      const list = await env.BUCKET.list({ prefix: 'decisions/' });
      return json(await Promise.all(list.objects.map(async (o) => ({ key: o.key, ...(await (await env.BUCKET.get(o.key)).json()) }))));
    }
    case 'POST /api/sync/ack': {
      // Only the decision the sync applied: one made on the phone since then stays for the next sync.
      const { done = [] } = await req.json();
      let deleted = 0;
      for (const { key, at } of done) {
        if (!/^decisions\/[\w.-]+\.json$/.test(key)) continue;
        const cur = await (await env.BUCKET.get(key))?.json();
        if (cur && cur.at === at) { await env.BUCKET.delete(key); deleted++; }
      }
      return json({ deleted });
    }
    case 'PUT /api/sync/queue': {
      const q = await req.json();
      if (!Array.isArray(q.items)) return text('items missing', 400);
      await env.BUCKET.put('queue.json', JSON.stringify({ ...q, synced: new Date().toISOString() }), { httpMetadata: { contentType: 'application/json' } });
      // Files no item names any more are deleted, so the bucket holds only what's queued.
      const keep = new Set(q.items.flatMap((i) => Object.values(i.assetKeys ?? {})));
      let cursor, removed = 0;
      do {
        const page = await env.BUCKET.list({ prefix: 'a/', cursor });
        const gone = page.objects.map((o) => o.key).filter((k) => !keep.has(k));
        if (gone.length) { await env.BUCKET.delete(gone); removed += gone.length; }
        cursor = page.truncated ? page.cursor : undefined;
      } while (cursor);
      return json({ items: q.items.length, removed });
    }
    case 'GET /api/sync/asset':
      return (await env.BUCKET.head(key)) ? text('have it') : text('missing', 404);
    case 'POST /api/sync/upload': {
      const mpu = await env.BUCKET.createMultipartUpload(key, { httpMetadata: { contentType: url.searchParams.get('type') || 'application/octet-stream' } });
      return json({ uploadId: mpu.uploadId, partSize: PART });
    }
    case 'PUT /api/sync/upload': {
      const mpu = env.BUCKET.resumeMultipartUpload(key, url.searchParams.get('uploadId'));
      const part = await mpu.uploadPart(Number(url.searchParams.get('part')), await req.arrayBuffer());
      return json(part);
    }
    case 'POST /api/sync/complete': {
      const { uploadId, parts } = await req.json();
      await env.BUCKET.resumeMultipartUpload(key, uploadId).complete(parts);
      return json({ ok: true });
    }
    case 'POST /api/sync/test-push':
      return json({ sent: await pushAll(env) });
  }
  return text('not found', 404);
}

// --- Routes ----------------------------------------------------------------
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!env.BOARD_PASSWORD || !env.SYNC_TOKEN) return text('Set the BOARD_PASSWORD and SYNC_TOKEN secrets (see board-cloud/README.md).', 500);
    if (url.pathname.startsWith('/api/sync/')) return syncApi(req, env, url);
    if (url.pathname === '/login') return req.method === 'POST' ? login(req, env) : loginPage();
    if (!(await signedIn(req, env))) {
      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '')) return loginPage();
      return text('sign in first', 401);
    }
    // Writes only from this site's own pages.
    if (req.method === 'POST' && req.headers.get('origin') && req.headers.get('origin') !== url.origin) return text('wrong origin', 403);

    if (req.method === 'GET' && url.pathname === '/') {
      const q = await loadQueue(env);
      return html(page(q.items, { cloud: true, vapidPublic: env.VAPID_PUBLIC }));
    }
    if (req.method === 'GET' && url.pathname === '/asset') return serveAsset(req, env, url);
    if (req.method === 'GET' && url.pathname === '/reminders.ics') {
      const q = await loadQueue(env);
      return new Response(calendar(q.items, url.origin), { headers: { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': 'attachment; filename="posts-to-do.ics"' } });
    }
    if (req.method === 'POST' && url.pathname === '/decide') {
      const { file, status, note, out_url } = await req.json();
      if (!STATUSES.has(status)) return text('unknown status', 400);
      const q = await loadQueue(env);
      const it = q.items.find((i) => i.file === file);
      if (!it) return text('unknown item', 400);
      await env.BUCKET.put(`decisions/${idOf(it)}.json`, JSON.stringify({ file, id: idOf(it), status, note, out_url, at: new Date().toISOString() }));
      return text('ok');
    }
    if (req.method === 'POST' && url.pathname === '/api/push/subscribe') {
      const sub = await req.json();
      if (!/^https:\/\//.test(sub?.endpoint ?? '')) return text('bad subscription', 400);
      const id = b64url(await crypto.subtle.digest('SHA-256', enc.encode(sub.endpoint))).slice(0, 32);
      await env.BUCKET.put(`subs/${id}.json`, JSON.stringify(sub));
      return text('ok');
    }
    if (req.method === 'GET' && url.pathname === '/api/push/next') return json(await nextUp(env));
    return text('not found', 404);
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(remind(env));
  },
};
