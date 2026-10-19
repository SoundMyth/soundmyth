// Pass 6 double-booking detection (lib/conflicts.js) and Pass 3b festival fragments (lib/normalize.js).
// Detection never deletes or strips: these tests also pin that the input is left untouched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { planFestivalFragments, eventTier, venueKeyOf, makeFestivalTest } from '../lib/normalize.js';
import { detectConflicts, isFestivalLike, CATEGORY } from '../lib/conflicts.js';
import { makeFestivalNameTest } from '../lib/genres.js';

const here = dirname(fileURLToPath(import.meta.url));
const ev = (o) => ({ djs: [], city: 'X', country: 'Y', venue: '', name: '', source: 'songkick', tags: [], ...o });
const SK_FEST = 'https://www.songkick.com/festivals/916004-scream/id/43133962-scream-2026';

test('eventTier: official/RA beats Songkick single show beats festival fragment', () => {
  assert.equal(eventTier({ source: 'ra' }, false), 0);
  assert.equal(eventTier({ source: 'direct' }, true), 0);
  assert.equal(eventTier({ source: 'songkick' }, false), 1);
  assert.equal(eventTier({ source: 'songkick' }, true), 2);
});

// ── Exclusions: each festival signal on its own ───────────────────────────────────

test('exclusion: Songkick festival edition URL (festival-start dating) is festival-like', () => {
  assert.equal(isFestivalLike(ev({ name: 'Sara Landry @ Edmonton EXPO Centre (EEC)', ticket_url: SK_FEST })), true);
});

test('exclusion: a plain Songkick concert URL is not festival-like', () => {
  assert.equal(isFestivalLike(ev({ name: 'Alok @ Hard Rock', ticket_url: 'https://www.songkick.com/concerts/43343846-alok' })), false);
});

test('exclusion: festival tag', () => {
  assert.equal(isFestivalLike(ev({ name: 'Alok @ Hard Rock', tags: ['festival'] })), true);
});

test('exclusion: FEST_WORD (festival / fest / open air / weekender) in name or venue', () => {
  assert.equal(isFestivalLike(ev({ name: 'Weekender Brighton', venue: 'Ocean' })), true);
  assert.equal(isFestivalLike(ev({ name: 'Luca Testa @ Open Air Castelletto Stura' })), true);
  assert.equal(isFestivalLike(ev({ name: 'Alok', venue: 'Summer Fest Club' })), true);
});

test('exclusion: curated festival name match (reuses makeFestivalNameTest)', () => {
  const isN = makeFestivalNameTest(['Time Warp']);
  assert.equal(isFestivalLike(ev({ name: 'Time Warp Mexico 2026', venue: 'Expo Santa Fe' }), isN), true);
  assert.equal(isFestivalLike(ev({ name: 'Time Warp Mexico 2026', venue: 'Expo Santa Fe' })), false);
});

test('exclusion: multi-act lineup (more than one DJ)', () => {
  assert.equal(isFestivalLike(ev({ name: 'Club Night', djs: ['Alok', 'Martin Garrix'] })), true);
  assert.equal(isFestivalLike(ev({ name: 'Club Night', djs: ['Alok'] })), false);
});

test('exclusion: festival source_id prefixes and the _festival flag from Pass 3b', () => {
  assert.equal(isFestivalLike(ev({ name: 'Alok @ Tinker Field', source_id: 'sk_fest_1' })), true);
  assert.equal(isFestivalLike(ev({ name: 'Alok @ Tinker Field', source_id: 'bit_fest_1' })), true);
  assert.equal(isFestivalLike(ev({ name: 'Alok @ Tinker Field', _festival: true })), true);
});

test('exclusion: a festival on either side of a pair means no conflict at all, and it is counted', () => {
  const club = ev({ id: 1, name: 'Carl Cox @ Coca-Cola Roxy', venue: 'Coca-Cola Roxy', city: 'Atlanta', country: 'United States', date: '2026-11-13', djs: ['Carl Cox'], source: 'songkick' });
  const fest = ev({ id: 2, name: 'Carl Cox @ Goldring Woldenberg Riverfront Park', venue: 'Goldring Woldenberg Riverfront Park', city: 'New Orleans', country: 'United States', date: '2026-11-13', djs: ['Carl Cox'], source: 'songkick', ticket_url: 'https://www.songkick.com/festivals/1-x/id/2-x-2026' });
  const out = detectConflicts([club, fest]);
  assert.deepEqual(out.pairs, []);
  assert.equal(out.ignoredFestival, 1);
});

test('a plain single show is not festival-like', () => {
  assert.equal(isFestivalLike(ev({ name: 'Alok @ Hard Rock', venue: 'Hard Rock', djs: ['Alok'] })), false);
});

// ── Categories ────────────────────────────────────────────────────────────────────

test('likely-error: two single shows in different countries on the same day', () => {
  const a = ev({ id: 1, name: 'Rossi. @ Austin Venue', venue: 'Austin Venue', city: 'Austin', country: 'United States', date: '2026-12-11', djs: ['Rossi.'] });
  const b = ev({ id: 2, name: 'Rossi. @ Hannover Venue', venue: 'Hannover Venue', city: 'Hannover', country: 'Germany', date: '2026-12-11', djs: ['Rossi.'] });
  const out = detectConflicts([a, b]);
  assert.equal(out.pairs.length, 1);
  assert.equal(out.pairs[0].category, CATEGORY.LIKELY_ERROR);
  assert.equal(out.pairs[0].dj, 'Rossi.');
  assert.equal(out.pairs[0].date, '2026-12-11');
});

test('possible-double-header: two single shows in the same country on the same day', () => {
  const a = ev({ id: 1, city: 'Fortaleza', country: 'Brazil', date: '2026-11-01', djs: ['Vintage Culture'] });
  const b = ev({ id: 2, city: 'Teresina', country: 'Brazil', date: '2026-11-01', djs: ['Vintage Culture'] });
  const out = detectConflicts([a, b]);
  assert.equal(out.pairs.length, 1);
  assert.equal(out.pairs[0].category, CATEGORY.DOUBLE_HEADER);
});

test('same city (incl. borough aliases) and different dates are not conflicts; empty city is ignored', () => {
  const a = ev({ id: 1, city: 'Brooklyn', country: 'United States', date: '2026-11-06', djs: ['Bonobo'] });
  const b = ev({ id: 2, city: 'New York', country: 'United States', date: '2026-11-06', djs: ['Bonobo'] });
  const c = ev({ id: 3, city: 'Berlin', country: 'Germany', date: '2026-11-07', djs: ['Bonobo'] });
  const d = ev({ id: 4, city: '', country: 'Germany', date: '2026-11-06', djs: ['Bonobo'] });
  assert.deepEqual(detectConflicts([a, b, c, d]).pairs, []);
});

test('missing country on either side cannot prove a different country: possible-double-header', () => {
  const a = ev({ id: 1, city: 'Berlin', country: '', date: '2026-11-06', djs: ['Alok'] });
  const b = ev({ id: 2, city: 'Paris', country: 'France', date: '2026-11-06', djs: ['Alok'] });
  assert.equal(detectConflicts([a, b]).pairs[0].category, CATEGORY.DOUBLE_HEADER);
});

test('pairs list likely errors first, then by date; each side is summarized with the reviewer fields', () => {
  const dh1 = ev({ id: 1, city: 'Fortaleza', country: 'Brazil', date: '2026-10-20', djs: ['Dh'] });
  const dh2 = ev({ id: 2, city: 'Teresina', country: 'Brazil', date: '2026-10-20', djs: ['Dh'] });
  const le1 = ev({ id: 3, city: 'Austin', country: 'United States', date: '2026-12-11', djs: ['Le'], name: 'Le @ A', venue: 'A', source: 'ra', ticket_url: 'https://x' });
  const le2 = ev({ id: 4, city: 'Hannover', country: 'Germany', date: '2026-12-11', djs: ['Le'], name: 'Le @ H', venue: 'H', source: 'songkick' });
  const out = detectConflicts([dh1, dh2, le1, le2]);
  assert.deepEqual(out.pairs.map(p => p.category), [CATEGORY.LIKELY_ERROR, CATEGORY.DOUBLE_HEADER]);
  const side = out.pairs[0].a;
  assert.deepEqual(Object.keys(side).sort(), ['city', 'country', 'date', 'id', 'name', 'source', 'source_id', 'ticket_url', 'venue']);
  assert.equal(side.source, 'ra', 'official/RA listing is listed first within a pair');
});

test('detection is read-only: inputs are not modified and no action is returned', () => {
  const a = ev({ id: 1, city: 'Berlin', country: 'Germany', date: '2026-11-06', djs: ['Alok', 'Other'] });
  const b = ev({ id: 2, city: 'Paris', country: 'France', date: '2026-11-06', djs: ['Alok'] });
  const c = ev({ id: 3, city: 'Madrid', country: 'Spain', date: '2026-11-06', djs: ['Solo'] });
  const d = ev({ id: 4, city: 'Lisbon', country: 'Portugal', date: '2026-11-06', djs: ['Solo'] });
  const before = JSON.stringify([a, b, c, d]);
  const out = detectConflicts([a, b, c, d]);
  assert.equal(JSON.stringify([a, b, c, d]), before);
  assert.deepEqual(Object.keys(out).sort(), ['ignoredFestival', 'pairs']);
  assert.equal(out.pairs.length, 1);
  assert.equal(out.pairs[0].dj, 'Solo');
});

// ── Pass 3b: festival fragments (unchanged rules) ───────────────────────────────────

const FESTS = ['Electric Daisy Carnival - EDC Orlando', 'EDC Orlando'];

test('planFestivalFragments: per-artist Tinker Field rows join the EDC Orlando festival row', () => {
  const master = ev({ id: 'm', name: 'Electric Daisy Carnival - EDC Orlando (18+) 2026 @ Tinker Field', venue: 'Tinker Field', city: 'Orlando', date: '2026-11-08', djs: [] });
  const frag1  = ev({ id: 'f1', name: 'Martin Garrix @ Tinker Field', venue: 'Tinker Field', city: 'Orlando', date: '2026-11-06', djs: ['Martin Garrix'] });
  const frag2  = ev({ id: 'f2', name: 'Alok @ Tinker Field', venue: 'Tinker Field', city: 'Orlando', date: '2026-11-06', djs: ['Alok'] });
  const plan = planFestivalFragments([master, frag1, frag2], FESTS);
  assert.deepEqual(plan.map(p => p.fragmentId).sort(), ['f1', 'f2']);
  assert.ok(plan.every(p => p.masterId === 'm'));
});

test('planFestivalFragments: no merge when venue, city or span do not match', () => {
  const master = ev({ id: 'm', name: 'Electric Daisy Carnival - EDC Orlando 2026', venue: 'Tinker Field', city: 'Orlando', date: '2026-11-08' });
  const otherVenue = ev({ id: 'a', name: 'Alok @ Hard Rock', venue: 'Hard Rock', city: 'Orlando', date: '2026-11-06', djs: ['Alok'] });
  const otherCity  = ev({ id: 'b', name: 'Alok @ Tinker Field', venue: 'Tinker Field', city: 'Miami', date: '2026-11-06', djs: ['Alok'] });
  const tooFar     = ev({ id: 'c', name: 'Alok @ Tinker Field', venue: 'Tinker Field', city: 'Orlando', date: '2026-11-20', djs: ['Alok'] });
  assert.deepEqual(planFestivalFragments([master, otherVenue, otherCity, tooFar], FESTS), []);
});

test('planFestivalFragments: a festival-named row that already has a lineup is not a master', () => {
  const withLineup = ev({ id: 'm', name: 'EDC Orlando 2026 @ Tinker Field', venue: 'Tinker Field', city: 'Orlando', date: '2026-11-08', djs: ['Someone'] });
  const frag = ev({ id: 'f', name: 'Alok @ Tinker Field', venue: 'Tinker Field', city: 'Orlando', date: '2026-11-06', djs: ['Alok'] });
  assert.deepEqual(planFestivalFragments([withLineup, frag], FESTS), []);
});

test('venueKeyOf and makeFestivalTest', () => {
  assert.equal(venueKeyOf({ name: 'Martin Garrix @ Tinker Field', venue: '' }), 'tinker field');
  assert.equal(venueKeyOf({ name: 'Club Night', venue: 'Tinker Field' }), 'tinker field');
  const isFest = makeFestivalTest(FESTS);
  assert.equal(isFest({ name: 'Electric Daisy Carnival - EDC Orlando 2026', venue: '' }), true);
  assert.equal(isFest({ name: 'Alok @ Tinker Field', venue: 'Tinker Field' }), false);
});

// ── Regression: the 2026-10-18 production run (142 conflicts, 140 events deleted) ──────

test('regression: the 2026-10-18 snapshot yields 0 actions, 115 festival pairs ignored (DGTL ADE now caught), 8 likely errors, 28 double-headers', () => {
  const fx = JSON.parse(readFileSync(resolve(here, 'fixtures/conflicts-2026-10-18.json'), 'utf8'));
  const festNames = JSON.parse(readFileSync(resolve(here, 'fixtures/festival-names-2026-10-18.json'), 'utf8'));
  assert.equal(fx.conflicts.length, 142);

  // The snapshot keeps one record per (DJ, date) group: the winner and its losers. Rebuild each
  // group as its own events (synthetic ids). The lineup and tags were not recorded, so each
  // event is a single DJ with no tags; the festival signals left are the URL, names and source.
  const events = [];
  fx.conflicts.forEach((c, i) => {
    for (const e of [c.kept, ...c.removed]) events.push({ ...e, id: `${i}:${e.id}`, djs: [c.dj], tags: [] });
  });
  const { pairs, ignoredFestival, ...rest } = detectConflicts(events, { festNames });

  assert.deepEqual(Object.keys(rest), [], 'no action fields in the result');
  assert.equal(ignoredFestival, 115);
  const likely = pairs.filter(p => p.category === CATEGORY.LIKELY_ERROR);
  const double = pairs.filter(p => p.category === CATEGORY.DOUBLE_HEADER);
  assert.equal(likely.length, 8);
  assert.equal(double.length, 28);
  assert.equal(pairs.length, 37);
  assert.deepEqual(likely.map(p => `${p.date} ${p.dj}`), [
    '2026-10-24 Talla 2XLC', '2026-10-25 O.BEE', '2026-10-31 Delta Heavy', '2026-10-31 Patrick Topping',
    '2026-11-07 Kanine', '2026-11-20 WHIPPED CREAM', '2026-11-28 Afrojack', '2026-12-04 Solardo', '2026-12-11 Rossi.',
  ]);
  // The Edmonton festival (Scream 2026) fragments must never surface as conflicts.
  assert.ok(!pairs.some(p => [p.a, p.b].some(e => e.city === 'Edmonton')));
});
