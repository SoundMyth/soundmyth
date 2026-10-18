// lib/db.js fetchAllRows: paging past PostgREST's 1000-row cap and partial-load reporting.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchAllRows } from '../lib/db.js';

const table = n => Array.from({ length: n }, (_, i) => ({ id: i }));

// Mimics a supabase query: resolves { data, error } for a [from, to] range.
function source(rows, { failFrom = null } = {}) {
  return async (from, to) => {
    if (failFrom !== null && from >= failFrom) return { data: null, error: { message: 'boom' } };
    return { data: rows.slice(from, to + 1), error: null };
  };
}

const opts = { retries: 1, delayMs: 0 };   // one attempt per page: no sleeps in tests

test('pages past the 1000-row cap and stops on the first short page', async () => {
  const calls = [];
  const src = source(table(2350));
  const res = await fetchAllRows((f, t) => { calls.push([f, t]); return src(f, t); }, opts);
  assert.equal(res.data.length, 2350);
  assert.equal(res.error, null);
  assert.equal(res.failedAt, null);
  assert.deepEqual(calls, [[0, 999], [1000, 1999], [2000, 2999]]);
});

test('an exact multiple of the page size costs one extra empty page', async () => {
  const calls = [];
  const src = source(table(2000));
  const res = await fetchAllRows((f, t) => { calls.push([f, t]); return src(f, t); }, opts);
  assert.equal(res.data.length, 2000);
  assert.equal(calls.length, 3);
});

test('an empty table returns no rows and no error', async () => {
  const res = await fetchAllRows(source([]), opts);
  assert.deepEqual(res, { data: [], error: null, failedAt: null });
});

test('a failed page returns the rows loaded before it, the error and the failing offset', async () => {
  const res = await fetchAllRows(source(table(2500), { failFrom: 1000 }), opts);
  assert.equal(res.data.length, 1000);
  assert.equal(res.failedAt, 1000);
  assert.equal(res.error.message, 'boom');
});

test('custom page size is honoured', async () => {
  const calls = [];
  const src = source(table(25));
  const res = await fetchAllRows((f, t) => { calls.push([f, t]); return src(f, t); }, { ...opts, pageSize: 10 });
  assert.equal(res.data.length, 25);
  assert.deepEqual(calls, [[0, 9], [10, 19], [20, 29]]);
});
