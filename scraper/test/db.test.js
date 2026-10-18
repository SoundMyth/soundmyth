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

test('uniqueById keeps the first occurrence of each id, in order', async () => {
  const { uniqueById } = await import('../lib/db.js');
  const rows = [{ id: 3, n: 'a' }, { id: 1 }, { id: 3, n: 'dup' }, { id: 2 }, { id: 1 }];
  assert.deepEqual(uniqueById(rows), [{ id: 3, n: 'a' }, { id: 1 }, { id: 2 }]);
  assert.deepEqual(uniqueById([]), []);
  assert.deepEqual(uniqueById(undefined), []);
});

test('orphanSavedIds: bookmarks whose event is missing from the complete id set', async () => {
  const { orphanSavedIds } = await import('../lib/db.js');
  const saved = [{ id: 1, event_id: 10 }, { id: 2, event_id: 11 }, { id: 3, event_id: 12 }];
  assert.deepEqual(orphanSavedIds(saved, new Set([10, 12])), [2]);
});

test('orphanSavedIds: an empty events set is never evidence of orphans', async () => {
  const { orphanSavedIds } = await import('../lib/db.js');
  assert.deepEqual(orphanSavedIds([{ id: 1, event_id: 10 }], new Set()), []);
  assert.deepEqual(orphanSavedIds([{ id: 1, event_id: 10 }], null), []);
  assert.deepEqual(orphanSavedIds(null, new Set([10])), []);
});

// ── purge orphan cleanup (lib/db.js cleanOrphanSaved) ────────────────────────────
// Fake client: select().order().range() for reads (optionally failing from an offset),
// delete().in() for deletes. Records every deleted saved_events id.
function fakeOrphanClient({ saved = [], events = [], failSavedFrom = null, failEventsFrom = null }) {
  const deleted = [];
  const page = (rows, from, to, failFrom) => failFrom !== null && from >= failFrom
    ? Promise.resolve({ data: null, error: { message: 'read boom' } })
    : Promise.resolve({ data: rows.slice(from, to + 1), error: null });
  return {
    deleted,
    from(table) {
      const rows = table === 'saved_events' ? saved : events;
      const failFrom = table === 'saved_events' ? failSavedFrom : failEventsFrom;
      return {
        select() { return { order() { return { range(from, to) { return page(rows, from, to, failFrom); } }; } }; },
        delete() { return { in(_col, ids) { deleted.push(...ids); return Promise.resolve({ error: null, count: ids.length }); } }; },
      };
    },
  };
}
const quick = { retries: 1, delayMs: 0 };

test('cleanOrphanSaved: deletes only bookmarks whose event is gone', async () => {
  const { cleanOrphanSaved } = await import('../lib/db.js');
  const sb = fakeOrphanClient({ saved: [{ id: 1, event_id: 10 }, { id: 2, event_id: 99 }], events: [{ id: 10 }] });
  const res = await cleanOrphanSaved(sb, quick);
  assert.equal(res.status, 'ok');
  assert.deepEqual(sb.deleted, [2]);
  assert.equal(res.deleted, 1);
});

test('cleanOrphanSaved: an events read that fails mid-way aborts and deletes nothing', async () => {
  const { cleanOrphanSaved } = await import('../lib/db.js');
  const events = Array.from({ length: 1500 }, (_, i) => ({ id: i + 1 }));
  const saved = [{ id: 5000, event_id: 1400 }];   // exists, but only on the page that fails
  const sb = fakeOrphanClient({ saved, events, failEventsFrom: 1000 });
  const res = await cleanOrphanSaved(sb, quick);
  assert.equal(res.status, 'aborted');
  assert.match(res.reason, /events read failed/);
  assert.deepEqual(sb.deleted, []);
});

test('cleanOrphanSaved: a saved_events read that fails aborts and deletes nothing', async () => {
  const { cleanOrphanSaved } = await import('../lib/db.js');
  const saved = Array.from({ length: 1500 }, (_, i) => ({ id: i + 1, event_id: 10 }));
  const sb = fakeOrphanClient({ saved, events: [{ id: 10 }], failSavedFrom: 1000 });
  const res = await cleanOrphanSaved(sb, quick);
  assert.equal(res.status, 'aborted');
  assert.match(res.reason, /saved_events read failed/);
  assert.deepEqual(sb.deleted, []);
});

test('cleanOrphanSaved: zero events is never evidence: bookmarks are kept', async () => {
  const { cleanOrphanSaved } = await import('../lib/db.js');
  const sb = fakeOrphanClient({ saved: [{ id: 1, event_id: 10 }], events: [] });
  const res = await cleanOrphanSaved(sb, quick);
  assert.equal(res.status, 'skipped');
  assert.deepEqual(sb.deleted, []);
});
