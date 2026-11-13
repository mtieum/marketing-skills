// node --test plugins/marketing/tools/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_LIMITS, decide, matcher, norm, parseFeed, prefilter, tracked, tripDays } from './listen-lib.mjs';

const index = [
  { name: 'Kraków', aliases: ['Cracow'], url: 'https://ex.test/krakow/two-nights/', kind: 'itinerary' },
  { name: 'Krakow', url: 'https://ex.test/krakow/', kind: 'city' },
  { name: 'York', url: 'https://ex.test/york/', kind: 'city' },
  { name: 'New York', url: 'https://ex.test/new-york/', kind: 'city' },
];
const match = matcher(index);

test('names meet whatever the accents', () => {
  assert.equal(norm('Kraków!'), 'krakow');
  assert.equal(norm('Wrocław'), 'wroclaw');
});

test('the itinerary beats the city page, the longer name beats the shorter', () => {
  assert.equal(match('2 days in krakow?').kind, 'itinerary');
  assert.equal(match('Cracow in December').kind, 'itinerary');
  assert.equal(match('a weekend in New York').url, 'https://ex.test/new-york/');
  assert.equal(match('yorkshire'), null);
});

test('prefilter needs a length and a place', () => {
  assert.ok(prefilter({ title: '3 nights in Kraków, what to do?', body: '' }, match));
  assert.ok(prefilter({ title: 'Weekend in York', body: '' }, match));
  assert.equal(prefilter({ title: 'Kraków or Prague?', body: 'no idea' }, match), null);
  assert.equal(prefilter({ title: '2 days in Lima', body: '' }, match), null);
});

test('a trip of a week or more goes to the country route, a short one to the city', () => {
  const m = matcher([...index, { name: 'Thailand', url: 'https://ex.test/thailand/two-weeks/', kind: 'route' }, { name: 'Bangkok', url: 'https://ex.test/bangkok/two-nights/', kind: 'itinerary' }]);
  assert.equal(tripDays('15 Days in thailand in Nov'), 15);
  assert.equal(tripDays('two weeks, then 3 nights in Bangkok'), 14);
  assert.equal(tripDays('a weekend'), 0);
  assert.equal(m('15 Days in Thailand: 2 nights Bangkok then Chiang Mai').kind, 'route');
  assert.equal(m('2 days in Bangkok, Thailand').kind, 'itinerary');
  assert.equal(m('3 days in Thailand, where?'), null); // a short trip names no city: nothing fits
});

test('feeds: Atom entries', () => {
  const xml = `<feed><entry><id>t3_x</id><title>2 days in Kraków?</title><link href="https://r.test/x/"/><published>2026-11-10T10:00:00+00:00</published><content type="html">&lt;p&gt;First time &amp;amp; no car&lt;/p&gt;</content><author><name>/u/a</name></author></entry></feed>`;
  const [e] = parseFeed(xml);
  assert.equal(e.title, '2 days in Kraków?');
  assert.equal(e.url, 'https://r.test/x/');
  assert.equal(e.body, 'First time & no car');
  assert.equal(e.author, '/u/a');
  assert.equal(e.at, Date.parse('2026-11-10T10:00:00Z'));
});

test('tracking on the link', () => {
  assert.equal(tracked('https://ex.test/a/', { source: 'reddit', campaign: 'solotravel' }), 'https://ex.test/a/?utm_source=reddit&utm_medium=reply&utm_campaign=solotravel');
});

const now = Date.parse('2026-11-10T12:00:00Z');
const H = 3600000;
const c = { url: 'https://r.test/new/', source: 'r/solotravel', fit: 8 };
const open = { links_allowed: true };
const loose = { max_link_share: 1 };
const unlinked = (n, source = 'r/x') => Array.from({ length: n }, (_, i) => ({ source, thread: `u${i}`, linked: false, at: now - 2 * 86400000, status: 'out' }));

test('a good fit is offered; the link waits for the share of linked replies', () => {
  assert.deepEqual(decide(c, open, [], {}, now).offer, true);
  assert.equal(decide(c, open, [], {}, now).link, false); // the first reply of all: no link at 10%
  assert.equal(decide(c, open, unlinked(9), {}, now).link, true); // the tenth may carry one
});

test('hard limits', () => {
  assert.equal(decide({ ...c, fit: 5 }, open, [], loose, now).offer, false);
  assert.equal(decide(c, { ...open, muted_until: '2026-12-01' }, [], loose, now).offer, false);
  assert.equal(decide(c, open, [{ source: 'r/x', thread: c.url, linked: false, at: now - H, status: 'out' }], loose, now).offer, false);
  assert.equal(decide(c, { links_allowed: false }, [], loose, now).link, false);
  assert.equal(decide({ ...c, link_in_thread: true }, open, [], loose, now).link, false);
  const sameSourceToday = [{ source: c.source, thread: 'a', linked: true, at: now - H, status: 'out' }];
  assert.equal(decide(c, open, sameSourceToday, loose, now).link, false);
  const week = [1, 2, 3].map((d) => ({ source: c.source, thread: `w${d}`, linked: true, at: now - d * 86400000 - H, status: 'out' }));
  assert.equal(decide(c, open, week, loose, now).link, false);
  const fiveToday = [1, 2, 3, 4, 5].map((i) => ({ source: `r/${i}`, thread: `t${i}`, linked: true, at: now - H, status: 'out' }));
  assert.equal(decide(c, open, fiveToday, loose, now).link, false);
  const full = Array.from({ length: DEFAULT_LIMITS.offers_per_day }, (_, i) => ({ source: 'r/y', thread: `f${i}`, linked: false, at: now - H, status: 'ready' }));
  assert.equal(decide(c, open, full, loose, now).offer, false);
  const skipped = full.map((h) => ({ ...h, status: 'rejected' }));
  assert.equal(decide(c, open, skipped, loose, now).offer, true); // skipped cards don't use up the day
});
