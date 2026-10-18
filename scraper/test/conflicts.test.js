import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findDoubleBookings, planFestivalFragments, eventTier, venueKeyOf, makeFestivalTest } from '../normalize.js';

const FESTS = ['Electric Daisy Carnival - EDC Orlando', 'EDC Orlando'];

const ev = (o) => ({ djs: [], city: 'X', country: 'Y', venue: '', name: '', source: 'songkick', ...o });

test('eventTier: official/RA beats Songkick single show beats festival fragment', () => {
  assert.equal(eventTier({ source: 'ra' }, false), 0);
  assert.equal(eventTier({ source: 'direct' }, true), 0);
  assert.equal(eventTier({ source: 'songkick' }, false), 1);
  assert.equal(eventTier({ source: 'songkick' }, true), 2);
});

test('findDoubleBookings: festival fragment loses to a Songkick single show in another city', () => {
  const omnia = ev({ id: 1, name: 'Martin Garrix @ Omnia Las Vegas', venue: 'Omnia Las Vegas', city: 'Las Vegas', date: '2026-11-06', djs: ['Martin Garrix'] });
  const frag  = ev({ id: 2, name: 'Martin Garrix @ Tinker Field', venue: 'Tinker Field', city: 'Orlando', date: '2026-11-06', djs: ['Martin Garrix'] });
  const out = findDoubleBookings([omnia, frag], { isFestival: e => e.id === 2 });
  assert.equal(out.length, 1);
  assert.equal(out[0].winner.id, 1);
  assert.deepEqual(out[0].losers.map(e => e.id), [2]);
  assert.equal(out[0].dj, 'Martin Garrix');
  assert.equal(out[0].date, '2026-11-06');
});

test('findDoubleBookings: RA listing beats a Songkick show (Paranoid London case)', () => {
  const ra = ev({ id: 3, source: 'ra', city: 'Leeds', date: '2026-11-06', djs: ['Paranoid London', 'OJ Willis'] });
  const sk = ev({ id: 4, source: 'songkick', city: 'Kortrijk', date: '2026-11-06', djs: ['Paranoid London'] });
  const out = findDoubleBookings([sk, ra]);
  assert.equal(out[0].winner.id, 3);
  assert.deepEqual(out[0].losers.map(e => e.id), [4]);
});

test('findDoubleBookings: same city (incl. borough aliases) is not a conflict', () => {
  const a = ev({ id: 5, city: 'Brooklyn', date: '2026-11-06', djs: ['Bonobo'] });
  const b = ev({ id: 6, city: 'New York', date: '2026-11-06', djs: ['Bonobo'] });
  assert.deepEqual(findDoubleBookings([a, b]), []);
});

test('findDoubleBookings: different dates are not conflicts; empty city is ignored', () => {
  const a = ev({ id: 7, city: 'Berlin', date: '2026-11-06', djs: ['Alok'] });
  const b = ev({ id: 8, city: 'Paris', date: '2026-11-07', djs: ['Alok'] });
  const c = ev({ id: 9, city: '', date: '2026-11-06', djs: ['Alok'] });
  assert.deepEqual(findDoubleBookings([a, b, c]), []);
});

test('findDoubleBookings: winner ties broken by richness, then id', () => {
  const a = ev({ id: 10, city: 'Berlin', date: '2026-11-06', djs: ['Alok'], source: 'songkick' });
  const b = ev({ id: 11, city: 'Paris', date: '2026-11-06', djs: ['Alok', 'X', 'Y'], source: 'songkick' });
  const out = findDoubleBookings([a, b], { richness: e => e.djs.length });
  assert.equal(out[0].winner.id, 11);
});

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
