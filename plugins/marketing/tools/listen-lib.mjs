// Forum listening, the pure parts: reading feeds, the cheap prefilter, matching a question to a
// page of the brand's, and the guardrails that decide whether a reply may be offered (and with a
// link). No I/O here, so it is easy to test (listen-lib.test.mjs). The CLI is listen.mjs.

/** Lower case, accents and punctuation gone: "Kraków" and "krakow" meet. */
export const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", nbsp: ' ' };
export const decode = (s) => String(s ?? '').replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) =>
  e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e.toLowerCase()] ?? m);
export const textOf = (html) => decode(decode(String(html ?? '')).replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>|<\/p>|<\/li>|<\/h\d>/gi, '\n').replace(/<[^>]+>/g, ' '))
  .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();

/** Entries of an Atom or RSS feed: { id, url, title, body, author, at } (at in ms). */
export function parseFeed(xml) {
  const tag = (s, t) => s.match(new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)</${t}>`, 'i'))?.[1]?.replace(/^<!\[CDATA\[|\]\]>$/g, '') ?? '';
  const out = [];
  for (const [, e] of String(xml).matchAll(/<(?:entry|item)(?:\s[^>]*)?>([\s\S]*?)<\/(?:entry|item)>/gi)) {
    const url = e.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? tag(e, 'link').trim();
    const at = Date.parse(tag(e, 'published') || tag(e, 'updated') || tag(e, 'pubDate'));
    out.push({
      id: tag(e, 'id').trim() || tag(e, 'guid').trim() || url,
      url: decode(url),
      title: textOf(tag(e, 'title')),
      body: textOf(tag(e, 'content') || tag(e, 'description')),
      author: textOf(tag(tag(e, 'author'), 'name') || tag(e, 'author') || tag(e, 'dc:creator')),
      // Where it was posted, in a combined feed (Reddit's r/a+b/new/.rss labels each entry r/a).
      category: e.match(/<category[^>]*label="([^"]+)"/i)?.[1] ?? e.match(/<category[^>]*term="([^"]+)"/i)?.[1] ?? '',
      at: Number.isFinite(at) ? at : null,
    });
  }
  return out;
}

/** A trip's length in the words people use: "2 days", "three nights", "a weekend in", "itinerary". */
export const DURATION = /\b(\d{1,2}|one|two|three|four|five|six|seven|ten|fourteen|a|couple of|few)\s*(-|\s)?(full\s)?(days?|nights?|weeks?)\b|\bweekend (in|trip|break)\b|\bcity break\b|\bitinerary\b|\bfirst time in\b|\bhow (many|long) (days|nights)\b/i;

/**
 * The page index: [{ name, aliases?, match?, country?, url, kind }] where kind is 'itinerary' (the best
 * answer) or 'city'. Returns a matcher: text → the best page it names, or null.
 */
export function matcher(index) {
  const names = [];
  for (const p of index) for (const n of p.match ?? [p.name, ...(p.aliases ?? [])]) { // `match` replaces the name when the name alone is too common
    const k = norm(n);
    if (k.length >= 3) names.push({ k, re: new RegExp(`(^| )${k.replace(/ /g, ' ')}( |$)`), p });
  }
  names.sort((a, b) => b.k.length - a.k.length); // "New York" before "York"
  const rank = { itinerary: 0, city: 1 };
  return (text) => {
    const t = ` ${norm(text)} `;
    const hits = names.filter((n) => n.re.test(t)).map((n) => n.p);
    if (!hits.length) return null;
    // Same place named twice (an itinerary and its city page): the itinerary wins.
    return hits.sort((a, b) => (rank[a.kind] ?? 2) - (rank[b.kind] ?? 2))[0];
  };
}

/** The cheap gate before any model sees a post: a trip length and a place the brand covers. */
export function prefilter(post, match) {
  const text = `${post.title}\n${post.body}`;
  if (!DURATION.test(text)) return null;
  return match(text);
}

/** The link with its tracking: {url}?utm_source=…&utm_medium=reply&utm_campaign=… */
export function tracked(url, { source, campaign }) {
  const u = new URL(url);
  u.searchParams.set('utm_source', source);
  u.searchParams.set('utm_medium', 'reply');
  u.searchParams.set('utm_campaign', campaign);
  return u.toString();
}

export const DEFAULT_LIMITS = {
  offers_per_day: 8, // reply cards put on the board each day
  links_per_day: 5, // replies with a link, all sources
  links_per_source_day: 1,
  links_per_source_week: 3,
  max_link_share: 0.1, // at most 1 reply in 10 carries a link (Reddit's old rule of thumb); loosen in listen.json
  mute_days: 30, // a removal, a mod warning or "Mute source" mutes the source this long
  min_fit: 7,
  max_age_hours: 24,
};

/**
 * May this candidate be offered today, and with a link?
 * history: replies already offered or posted, [{ source, thread, linked, at (ms), status }]
 * (rejected ones don't count). source: { links_allowed, muted_until }.
 * Returns { offer, link, reason }.
 */
export function decide(c, source, history, limits, now = Date.now()) {
  const L = { ...DEFAULT_LIMITS, ...limits };
  const day = 86400000;
  const live = history.filter((h) => h.status !== 'rejected');
  const today = live.filter((h) => now - h.at < day);
  if (source.muted_until && now < Date.parse(source.muted_until)) return { offer: false, link: false, reason: 'source muted' };
  if (live.some((h) => h.thread === c.url)) return { offer: false, link: false, reason: 'already replied in this thread' };
  if ((c.fit ?? 0) < L.min_fit) return { offer: false, link: false, reason: `fit ${c.fit ?? '?'} below ${L.min_fit}` };
  if (today.length >= L.offers_per_day) return { offer: false, link: false, reason: 'enough replies offered today' };
  const why = [];
  if (!source.links_allowed) why.push('links not allowed there');
  if (c.link_in_thread) why.push('the link is already in the thread');
  if (today.filter((h) => h.linked).length >= L.links_per_day) why.push('link limit for today');
  if (today.filter((h) => h.linked && h.source === c.source).length >= L.links_per_source_day) why.push('link limit for this source today');
  if (live.filter((h) => h.linked && h.source === c.source && now - h.at < 7 * day).length >= L.links_per_source_week) why.push('link limit for this source this week');
  const month = live.filter((h) => now - h.at < 30 * day);
  if ((month.filter((h) => h.linked).length + 1) / (month.length + 1) > L.max_link_share) why.push(`links would pass ${Math.round(L.max_link_share * 100)}% of replies`);
  return { offer: true, link: !why.length, reason: why.join('; ') || 'with link' };
}

/** The disclosure line, filled in: "I built a free planner with a 2-day {city} plan: {url} (my own project)". */
export const fill = (template, vars) => String(template).replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
