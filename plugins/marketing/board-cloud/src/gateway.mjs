// Gateway mode: the board hands approved posts to a publishing gateway (publish/PROTOCOL.md)
// and records what comes back. Off unless the workspace's publish.json turns a channel on and
// the GATEWAY_KEY secret is set. Everything not handed over stays on reminders.
//
// publish.json (in the workspace, uploaded by board-sync):
//   { "gateway": "https://gateway.example",
//     "channels": { "instagram": { "id": "ch_…", "auto": true, "options": { "ai_generated": true } },
//                   "pinterest": { "id": "ch_…", "auto": true } } }
//
// R2: sent/<id>.json  { hash, at, status, url, error }  what the gateway has, and its last word.
import { copyBlocks } from '../../tools/board-page.mjs';

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, enc.encode(data)));
}
const mediaKey = (env) => `media:${env.SYNC_TOKEN}`;
const SEND = new Set(['approved', 'ready']);
const FINAL = new Set(['published', 'failed', 'canceled']);

// --- Signed media links -----------------------------------------------------------
/** A link to one stored file that works without signing in, until `exp` (unix seconds). */
export async function signedMediaUrl(env, origin, key, exp) {
  return `${origin}/media/${key}?exp=${exp}&sig=${await hmac(mediaKey(env), `${key}.${exp}`)}`;
}
export async function mediaAllowed(env, key, exp, sig) {
  if (!/^a\/[\w.-]+$/.test(key) || !/^\d+$/.test(exp ?? '') || Number(exp) * 1000 < Date.now()) return false;
  const want = await hmac(mediaKey(env), `${key}.${exp}`);
  return want.length === (sig ?? '').length && crypto.subtle.timingSafeEqual(enc.encode(want), enc.encode(sig));
}

// --- The post, as the protocol wants it -----------------------------------------------
/** The item's fields, as the board shows them (labelled blocks or sections); plain text is the caption. */
function textOf(item) {
  const blocks = copyBlocks(item.text);
  if (blocks.length === 1 && !blocks[0].label) return { caption: item.text.trim() };
  const t = {};
  for (const { label, body } of blocks) {
    const k = label.toLowerCase();
    t[{ 'alt text': 'alt', 'text to paste': 'caption' }[k] ?? k] = body;
  }
  return t;
}

async function postFor(env, origin, item, ch, publishAt) {
  const MEDIA = /\.(mp4|mov|webm|png|jpe?g|webp|gif)$/i;
  const path = [].concat(item.meta.assets ?? []).find((p) => MEDIA.test(p) && item.assetKeys?.[p]);
  if (!path) return null;
  const key = item.assetKeys[path];
  const head = await env.BUCKET.head(key);
  if (!head) return null;
  const exp = Math.floor(publishAt / 1000) + 2 * 86400; // the protocol asks for a day after; two to be safe
  return {
    channel: ch.id,
    publish_at: new Date(publishAt).toISOString(),
    media: [{ url: await signedMediaUrl(env, origin, key, exp), type: head.httpMetadata?.contentType ?? 'video/mp4', bytes: head.size }],
    text: textOf(item),
    options: { privacy: 'public', ...(ch.options ?? {}) },
    approval: { by: 'owner', at: item.meta.decided ? `${item.meta.decided}T00:00:00Z` : new Date().toISOString() },
    callback: `${origin}/api/gateway/callback`,
  };
}

// --- Talking to the gateway -------------------------------------------------------
async function call(env, cfg, method, path, body) {
  const r = await fetch(`${cfg.gateway.replace(/\/$/, '')}${path}`, {
    method, headers: { authorization: `Bearer ${env.GATEWAY_KEY}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}
const getSent = async (env, id) => (await env.BUCKET.get(`sent/${id}.json`))?.json();
const putSent = (env, id, s) => env.BUCKET.put(`sent/${id}.json`, JSON.stringify(s));

/** The gateway's word on a post, recorded; a published post becomes a decision (out + its link) for the next sync. */
async function record(env, id, file, sent, post, notify) {
  const was = sent.status;
  Object.assign(sent, { status: post.status, url: post.url ?? null, error: post.error ?? null, checked: new Date().toISOString() });
  await putSent(env, id, sent);
  if (post.status === 'published' && was !== 'published') {
    await env.BUCKET.put(`decisions/${id}.json`, JSON.stringify({ file, id, status: 'out', out_url: post.url ?? undefined, note: 'posted by the gateway', at: new Date().toISOString() }));
  }
  if (post.status === 'failed' && was !== 'failed') await notify(`Didn't post: ${id}`, `${post.error?.message ?? 'the gateway failed'}. Post it by hand.`, id);
}

/**
 * Each cron: send approved items for gateway channels (or re-send when they changed),
 * cancel ones no longer approved, and read back the status of everything still in flight.
 */
export async function syncGateway(env, origin, q, { zonedDue, notify }) {
  const cfg = q.publish;
  if (!cfg?.gateway || !env.GATEWAY_KEY) return;
  for (const item of q.items) {
    const id = item.meta.id ?? item.file.replace(/\.md$/, '');
    const ch = cfg.channels?.[item.meta.channel];
    const sent = await getSent(env, id);
    const wanted = ch?.auto && SEND.has(item.meta.status) && item.meta.due;

    if (!wanted) {
      // Pulled back (changes, rejected, posted by hand) while still waiting: cancel it.
      if (sent && sent.status === 'scheduled') {
        const r = await call(env, cfg, 'DELETE', `/v0/posts/${encodeURIComponent(id)}`);
        if (r.ok || r.status === 404) await env.BUCKET.delete(`sent/${id}.json`);
        else if (r.data?.post) await record(env, id, item.file, sent, r.data.post, notify);
      }
      continue;
    }
    const publishAt = zonedDue(item);
    if (publishAt < Date.now() - 3600000 && !sent) continue; // over an hour late and never sent: leave it to the owner
    const post = await postFor(env, origin, item, ch, publishAt);
    if (!post) continue; // its file isn't uploaded yet
    const { media, ...stable } = post; // the signed link changes; the rest says whether the post did
    const hash = hex(await crypto.subtle.digest('SHA-256', enc.encode(JSON.stringify({ ...stable, media: media.map((m) => m.bytes) }))));
    if (!sent || (sent.hash !== hash && !['publishing', 'published'].includes(sent.status))) {
      const r = await call(env, cfg, 'PUT', `/v0/posts/${encodeURIComponent(id)}`, post);
      if (r.ok) await putSent(env, id, { hash, at: new Date().toISOString(), status: r.data.status, url: null, error: null });
      else {
        const s = { hash, at: new Date().toISOString(), status: 'failed', url: null, error: r.data?.error ?? { code: `http_${r.status}`, message: 'gateway refused it' } };
        if (sent?.error?.code !== s.error.code) await notify(`Can't schedule: ${id}`, `${s.error.message}. It stays on reminders.`, id);
        await putSent(env, id, s);
      }
      continue;
    }
    if (!FINAL.has(sent.status)) {
      const r = await call(env, cfg, 'GET', `/v0/posts/${encodeURIComponent(id)}`);
      if (r.ok) await record(env, id, item.file, sent, r.data, notify);
    }
  }
}

/** The gateway's callback: a signed status change. */
export async function gatewayCallback(req, env, q, notify) {
  const body = await req.text();
  const sig = req.headers.get('x-gateway-signature')?.match(/^t=(\d+),v1=([0-9a-f]{64})$/);
  if (!sig || !env.GATEWAY_CALLBACK_SECRET || Math.abs(Date.now() / 1000 - Number(sig[1])) > 300) return new Response('bad signature', { status: 401 });
  const want = await hmac(env.GATEWAY_CALLBACK_SECRET, `${sig[1]}.${body}`);
  if (!crypto.subtle.timingSafeEqual(enc.encode(want), enc.encode(sig[2]))) return new Response('bad signature', { status: 401 });
  const post = JSON.parse(body);
  const item = q.items.find((i) => (i.meta.id ?? i.file.replace(/\.md$/, '')) === post.client_id);
  const sent = await getSent(env, post.client_id);
  if (item && sent) await record(env, post.client_id, item.file, sent, post, notify);
  return new Response('ok');
}

/** For the page: what the gateway has, laid over each item's meta. */
export async function gatewayStates(env, q) {
  if (!q.publish?.gateway) return;
  const list = await env.BUCKET.list({ prefix: 'sent/' });
  const states = Object.fromEntries(await Promise.all(list.objects.map(async (o) => [o.key.slice(5, -5), await (await env.BUCKET.get(o.key)).json()])));
  for (const it of q.items) {
    const id = it.meta.id ?? it.file.replace(/\.md$/, '');
    const ch = q.publish.channels?.[it.meta.channel];
    if (ch?.auto) it.meta.auto = 'on';
    const s = states[id];
    if (s) { it.meta.gateway = s.status; if (s.error) it.meta.gateway_error = s.error.message; }
  }
}
