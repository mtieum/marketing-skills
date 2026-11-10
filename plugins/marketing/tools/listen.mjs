#!/usr/bin/env node
// Forum listening: find people asking for what the brand's pages answer, draft a helpful reply,
// and put it on the review board for the owner to post by hand. Nothing here logs in or posts.
//
//   node listen.mjs poll  <workspace>   read the feeds, keep fresh posts that pass the prefilter
//   node listen.mjs draft <workspace>   score and draft them with the chosen model (or leave them for an agent)
//   node listen.mjs offer <workspace>   put the best drafts on the board as reply cards, within the limits
//   node listen.mjs run   <workspace>   all three (for a timer)
//
// Config: <workspace>/listen.json (see templates/workspace/listen.json): feeds to read, sources
// (where posts come from: links_allowed each, set by hand after reading that place's rules). State: <workspace>/listen/
// (seen.json, state.json, candidates/*.json are working files; demand.csv is worth keeping).
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_LIMITS, decide, fill, matcher, norm, parseFeed, prefilter, textOf, tracked } from './listen-lib.mjs';
import { askJson, usesAgent } from './llm.mjs';
import { items as queueItems, setMeta } from './queue-lib.mjs';

const [cmd, wsArg] = process.argv.slice(2);
if (!['poll', 'draft', 'offer', 'run'].includes(cmd) || !wsArg) {
  console.error('usage: listen.mjs poll|draft|offer|run <workspace>');
  process.exit(2);
}
const WS = wsArg;
const DIR = join(WS, 'listen');
const CANDS = join(DIR, 'candidates');
mkdirSync(CANDS, { recursive: true });
const cfg = JSON.parse(readFileSync(join(WS, 'listen.json'), 'utf8'));
const LIMITS = { ...DEFAULT_LIMITS, ...cfg.limits };
const UA = cfg.user_agent ?? 'marketing-listen/0.1';
const readJson = (f, d) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : d);
const writeJson = (f, v) => writeFileSync(f, `${JSON.stringify(v, null, 2)}\n`);
const today = () => new Date().toISOString().slice(0, 10);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Keys for the model, if any, from the workspace's git-ignored .listen.env (KEY=value lines).
const envFile = join(WS, '.listen.env');
const ENV = { ...process.env };
if (existsSync(envFile)) for (const l of readFileSync(envFile, 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (m) ENV[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}

// Feeds ration requests (Reddit's RSS: about one a minute). Each host's last word on its limit is
// kept, and the next request to it waits for the reset rather than earning a 429.
const resetAt = {};
async function get(url, tries = 2) {
  const host = new URL(url).host;
  if (resetAt[host] > Date.now()) await wait(resetAt[host] - Date.now());
  const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/atom+xml, application/rss+xml, text/html;q=0.8, */*;q=0.5' }, signal: AbortSignal.timeout(20000) });
  const left = Number(r.headers.get('x-ratelimit-remaining')), reset = Number(r.headers.get('x-ratelimit-reset'));
  if (Number.isFinite(reset) && (left < 1 || r.status === 429)) resetAt[host] = Date.now() + (reset + 2) * 1000;
  if (r.status === 429 && tries > 1 && reset < 120) return get(url, tries - 1);
  if (!r.ok) throw new Error(`${url} answered ${r.status}`);
  return r.text();
}

const index = () => readJson(join(WS, cfg.pages ?? 'listen/pages.json'), []);
const candFile = (id) => join(CANDS, `${id}.json`);
const allCands = () => readdirSync(CANDS).filter((f) => f.endsWith('.json')).map((f) => readJson(join(CANDS, f)));
const idFor = (post, source) => `${today()}-${norm(source.name).replace(/ /g, '-')}-${(post.id.match(/[a-z0-9]+$/i)?.[0] ?? norm(post.url).slice(-12)).slice(-10)}`;

function demand(row) {
  const f = join(DIR, 'demand.csv');
  if (!existsSync(f)) writeFileSync(f, 'seen_at,city,country,nights,has,thread\n');
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  appendFileSync(f, `${[today(), row.city, row.country, row.nights, row.has, row.thread].map(q).join(',')}\n`);
}

async function poll() {
  const seen = readJson(join(DIR, 'seen.json'), {});
  const match = matcher(index());
  if (!index().length) console.warn('no page index (listen.json "pages"): nothing can match');
  const maxAge = LIMITS.max_age_hours * 3600000;
  let kept = 0, read = 0;
  for (const feed of cfg.feeds ?? []) {
    let posts;
    try { posts = parseFeed(await get(feed.url)); } catch (e) { console.warn(`${feed.name ?? feed.url}: ${e.message}`); continue; }
    for (const p of posts) {
      const source = { name: p.category || feed.name, platform: feed.platform };
      read++;
      if (seen[p.url] || !p.at || Date.now() - p.at > maxAge) continue;
      seen[p.url] = today();
      const page = prefilter(p, match);
      if (!page) continue;
      const id = idFor(p, source);
      writeJson(candFile(id), { id, source: source.name, platform: source.platform ?? 'reddit', comments_feed: !!feed.comments_feed, url: p.url, title: p.title, body: p.body.slice(0, 4000), author: p.author, at: new Date(p.at).toISOString(), page, status: 'new' });
      kept++;
    }
  }
  // Forget what is far older than any post we'd still answer.
  for (const [u, d] of Object.entries(seen)) if (Date.now() - Date.parse(d) > 14 * 86400000) delete seen[u];
  writeJson(join(DIR, 'seen.json'), seen);
  console.log(`poll: ${read} posts read from ${cfg.feeds?.length ?? 0} feed(s), ${kept} new candidate(s)`);
}

/** What the thread already says (its comments), when the source has a comments feed. */
async function comments(c) {
  if (!c.comments_feed) return [];
  try {
    const all = parseFeed(await get(`${c.url.replace(/\/?(\?.*)?$/, '')}/.rss`));
    return all.slice(1, 9).map((e) => ({ author: e.author, text: e.body.slice(0, 600) }));
  } catch { return []; }
}

/** The brand's own page, as text: the reply's facts come from here, not from the model's memory. */
async function pageFacts(url) {
  const html = await get(url);
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html;
  return textOf(main).slice(0, cfg.facts_chars ?? 7000);
}

const RULES = `You help a small brand answer travel-planning questions on public forums, as its owner would.
Write in English, as a person on a forum: plain sentences, casual, no headers, no emoji, no lists unless they truly help.
Rules for the reply:
1. Open with the direct answer to what they asked. No greeting, no "Great question".
2. Give 3-5 concrete tips that fit THIS person's interests, dates and constraints: named places, a rough plan per day, one practical tip (a pass, a booking warning).
3. 80-150 words. No marketing words ("ultimate", "hidden gem", "must-see", "unforgettable").
4. Use only facts from the FACTS section. If a fact isn't there, leave it out.
5. Never claim personal experience ("when I was there").
6. Write no links and no mention of the brand: a disclosed link is added after your text when allowed.
7. Don't start the way any of the RECENT OPENINGS start.
Scoring: fit_score 0-10 is how much a short plan for this place would help this person. Score low for hotel-only, visa-only, long multi-country or vague posts; 0 for minors, emergencies, lost documents, grief, or anything sensitive.`;

const SHAPE = `Answer with JSON only:
{"is_trip_planning_question": bool, "city": str|null, "country": str|null, "nights": int|null, "travel_month": str|null,
 "interests": [str], "constraints": [str], "already_answered_well": bool, "sensitive": bool, "fit_score": int,
 "summary": "what they asked, in at most two short lines", "reply": "the reply text, or empty if fit_score < 7"}`;

function recentOpenings() {
  return queueItems(WS).filter((i) => i.meta.kind === 'reply').slice(-20).map((i) => i.text.replace(/^[\s\S]*?```[^\n]*\n/, '').split(/[.!?\n]/)[0].slice(0, 80));
}

async function draftOne(c, model) {
  const [said, facts] = await Promise.all([comments(c), pageFacts(c.page.url)]);
  const user = [
    `ABOUT THE BRAND: ${cfg.about ?? ''}`,
    `THE POST (${c.source}, ${c.at}):\nTitle: ${c.title}\n${c.body}`,
    said.length ? `COMMENTS SO FAR:\n${said.map((s) => `- ${s.author}: ${s.text}`).join('\n')}` : 'COMMENTS SO FAR: none',
    `FACTS (the page the link would go to, ${c.page.url}):\n${facts}`,
    `RECENT OPENINGS:\n${recentOpenings().map((o) => `- ${o}`).join('\n') || '- none'}`,
    SHAPE,
  ].join('\n\n');
  const a = await askJson(model, RULES, user, ENV);
  const out = { ...c, ...a, fit: Number(a.fit_score ?? 0), link_in_thread: said.some((s) => cfg.domain && s.text.includes(cfg.domain)), drafted_at: new Date().toISOString(), drafted_by: `${model.provider}:${model.name ?? ''}` };
  // The model's place may not be the page the prefilter guessed; a place we have no page for is demand.
  const named = a.city ? matcher(index())(`${a.city} ${a.country ?? ''}`) : null;
  if (a.city && !named) { demand({ city: a.city, country: a.country, nights: a.nights, has: 'nothing', thread: c.url }); return { ...out, status: 'skipped', reason: 'no page for this place' }; }
  if (named) out.page = named;
  if (out.page.kind !== 'itinerary') demand({ city: a.city ?? out.page.name, country: a.country, nights: a.nights, has: 'city page', thread: c.url });
  const bad = !a.is_trip_planning_question ? 'not a planning question' : a.sensitive ? 'sensitive' : a.already_answered_well ? 'already answered well' : out.fit < LIMITS.min_fit ? `fit ${out.fit}` : !String(a.reply ?? '').trim() ? 'no reply' : null;
  return { ...out, status: bad ? 'skipped' : 'drafted', reason: bad ?? undefined };
}

async function draft() {
  const model = cfg.model;
  const waiting = allCands().filter((c) => c.status === 'new');
  if (usesAgent(model)) {
    console.log(`draft: ${waiting.length} candidate(s) wait for an agent (model provider "agent": run the listen skill)`);
    return;
  }
  let n = 0;
  for (const c of waiting) {
    try { const d = await draftOne(c, model); writeJson(candFile(c.id), d); if (d.status === 'drafted') n++; }
    catch (e) { console.warn(`${c.id}: ${e.message}`); }
  }
  // "Change…" on a reply card: draft it again with the owner's note.
  for (const it of queueItems(WS).filter((i) => i.meta.kind === 'reply' && i.meta.status === 'changes' && i.meta.candidate)) {
    const c = readJson(candFile(it.meta.candidate), null);
    if (!c) continue;
    try {
      const a = await askJson(model, RULES, `${`THE POST (${c.source}):\nTitle: ${c.title}\n${c.body}`}\n\nFACTS:\n${await pageFacts(c.page.url)}\n\nYOUR LAST REPLY:\n${c.reply}\n\nTHE OWNER ASKS: ${it.meta.owner_note ?? ''}\n\n${SHAPE}`, ENV);
      writeJson(candFile(c.id), { ...c, reply: a.reply ?? c.reply });
      writeItem({ ...c, reply: a.reply ?? c.reply }, { link: it.meta.linked === 'yes' }, it.file);
      setMeta(WS, it.file, { status: 'ready' });
      console.log(`redrafted ${it.file}`);
    } catch (e) { console.warn(`${it.file}: ${e.message}`); }
  }
  console.log(`draft: ${n} of ${waiting.length} drafted with ${model.provider}`);
}

/** A reply card in the queue: the reply (with the disclosed link when allowed) to copy, the thread to open. */
function writeItem(c, { link }, file = `${today()}-reply-${norm(c.source).replace(/ /g, '-')}-${c.id.split('-').pop()}.md`) {
  const url = tracked(c.page.url, { source: c.platform, campaign: norm(c.source).replace(/^r /, '').replace(/ /g, '-') });
  const disclosure = fill(cfg.disclosure?.[c.page.kind] ?? cfg.disclosure?.itinerary ?? '{url}', { url, city: c.page.name, nights: c.nights ?? 2 });
  const text = link ? `${c.reply.trim()}\n\n${disclosure}` : c.reply.trim();
  const q = (v) => JSON.stringify(String(v ?? ''));
  const fm = [
    `id: ${file.replace(/\.md$/, '')}`, 'kind: reply', `channel: ${c.platform}`, 'campaign: listening', 'status: ready', `due: ${today()}`,
    `source: ${q(c.source)}`, `thread: ${q(c.url)}`, `thread_title: ${q(c.title)}`, `posted_at: ${q(c.at)}`, `fit: ${c.fit}`,
    `linked: ${link ? 'yes' : 'no'}`, `link: ${q(url)}`, `candidate: ${c.id}`,
    `notes: ${q(`${c.source} · asked ${c.at.slice(0, 16).replace('T', ' ')} UTC · fit ${c.fit}${link ? '' : ' · no link'} · ${c.summary ?? ''}`)}`,
  ];
  writeFileSync(join(WS, 'queue', file), `---\n${fm.join('\n')}\n---\n\nReply:\n\`\`\`\n${text}\n\`\`\`\n`);
  return file;
}

function offer() {
  const state = readJson(join(DIR, 'state.json'), { muted: {} });
  const replies = queueItems(WS).filter((i) => i.meta.kind === 'reply');
  // "Mute source" (a reject whose note says mute), or a removal noted the same way: quiet for a while.
  for (const r of replies) if (r.meta.status === 'rejected' && /mute|removed|warn/i.test(r.meta.owner_note ?? '') && r.meta.source) {
    const until = new Date(Date.parse(r.meta.decided ?? today()) + LIMITS.mute_days * 86400000).toISOString().slice(0, 10);
    if (!state.muted[r.meta.source] || state.muted[r.meta.source] < until) state.muted[r.meta.source] = until;
  }
  // Cards nobody posted within two days: the thread has moved on.
  for (const r of replies) if (r.meta.status === 'ready' && Date.now() - Date.parse(r.meta.due) > 2 * 86400000) setMeta(WS, r.file, { status: 'rejected', owner_note: 'expired: the thread moved on' });
  const history = replies.map((r) => ({ source: r.meta.source, thread: r.meta.thread, linked: r.meta.linked === 'yes', at: Date.parse(r.meta.due), status: r.meta.status }));
  const ready = allCands().filter((c) => c.status === 'drafted').sort((a, b) => b.fit - a.fit);
  let n = 0;
  for (const c of ready) {
    const src = cfg.sources?.[c.source] ?? {};
    const d = decide(c, { links_allowed: !!src.links_allowed, muted_until: state.muted[c.source] }, history, LIMITS);
    if (!d.offer) {
      if (/muted|already|fit/.test(d.reason)) writeJson(candFile(c.id), { ...c, status: 'skipped', reason: d.reason });
      continue; // a daily limit: it may still go tomorrow, if it's fresh enough
    }
    const file = writeItem(c, d);
    writeJson(candFile(c.id), { ...c, status: 'offered', queue: file, link_reason: d.reason });
    history.push({ source: c.source, thread: c.url, linked: d.link, at: Date.now(), status: 'ready' });
    n++;
  }
  // Drafts too old to be worth it now.
  for (const c of allCands()) if (['new', 'drafted'].includes(c.status) && Date.now() - Date.parse(c.at) > LIMITS.max_age_hours * 3600000 * 1.5) writeJson(candFile(c.id), { ...c, status: 'skipped', reason: 'too old' });
  writeJson(join(DIR, 'state.json'), state);
  console.log(`offer: ${n} reply card(s) added to the queue`);
}

if (cmd === 'poll' || cmd === 'run') await poll();
if (cmd === 'draft' || cmd === 'run') await draft();
if (cmd === 'offer' || cmd === 'run') offer();
