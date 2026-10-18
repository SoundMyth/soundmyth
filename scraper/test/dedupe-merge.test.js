// Pure merge rules used by steps/09-dedupe.js: keeper handling and merged festival dates.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitKeeper, mergedDate } from '../lib/normalize.js';

test('splitKeeper: keeper is first, rest are the other rows', () => {
  const a = { id: 1 }, b = { id: 2 }, c = { id: 3 };
  const { keeper, rest } = splitKeeper([a, b, c]);
  assert.equal(keeper, a);
  assert.deepEqual(rest, [b, c]);
});

test('splitKeeper: a repeated keeper row (paging duplicate) is never deleted', () => {
  const keeper = { id: 190411, source_id: 'sk_43391102' };
  const dup = { ...keeper };                       // same id, second page
  const { keeper: k, rest } = splitKeeper([keeper, { id: 7 }, dup]);
  assert.equal(k, keeper);
  assert.deepEqual(rest.map(r => r.id), [7]);
  assert.ok(!rest.some(r => r.id === keeper.id));
});

test('splitKeeper: a single-row group has nothing to delete', () => {
  assert.deepEqual(splitKeeper([{ id: 5 }]).rest, []);
});

test('mergedDate: festival master keeps its date when fragments are earlier (EDC Orlando)', () => {
  const master = { id: 1, date: '2026-11-08' };
  const frag = { id: 2, date: '2026-11-06' };
  const d = mergedDate({ keeper: frag, rest: [master], masterIds: new Set([1]), isFestival: true });
  assert.equal(d, '2026-11-08');
});

test('mergedDate: master keeps its date even when it is the later of several fragments', () => {
  const master = { id: 1, date: '2026-10-31' };
  const f1 = { id: 2, date: '2026-10-30' }, f2 = { id: 3, date: '2026-10-29' };
  assert.equal(mergedDate({ keeper: f1, rest: [f2, master], masterIds: new Set([1]), isFestival: true }), '2026-10-31');
});

test('mergedDate: without a master, a merged festival takes the earliest date', () => {
  const a = { id: 1, date: '2026-11-07' }, b = { id: 2, date: '2026-11-06' };
  assert.equal(mergedDate({ keeper: a, rest: [b], isFestival: true }), '2026-11-06');
});

test('mergedDate: a non-festival keeps its own date', () => {
  const a = { id: 1, date: '2026-11-07' }, b = { id: 2, date: '2026-11-06' };
  assert.equal(mergedDate({ keeper: a, rest: [b], isFestival: false }), '2026-11-07');
});

test('mergedDate: rows without a date never win', () => {
  const a = { id: 1, date: '2026-11-07' }, b = { id: 2, date: '' };
  assert.equal(mergedDate({ keeper: a, rest: [b], isFestival: true }), '2026-11-07');
});
