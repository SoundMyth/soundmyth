// steps/15-build-artists.js: the DJ artifact is built from complete, stably ordered event reads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadUpcomingRows, djNamesFromRows } from '../steps/15-build-artists.js';

// Fake supabase chain: from().select().gte().order().range(); records the order calls.
function fakeClient(rows, { failFrom = null } = {}) {
  const orders = [];
  return {
    orders,
    from() {
      return {
        select() { return this; },
        gte() { return this; },
        order(col) { orders.push(col); return this; },
        range(from, to) {
          if (failFrom !== null && from >= failFrom) return Promise.resolve({ data: null, error: { message: 'boom' } });
          return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
        },
      };
    },
  };
}
const quick = { retries: 1, delayMs: 0 };

test('loadUpcomingRows pages every row and orders by id', async () => {
  const rows = Array.from({ length: 2100 }, (_, i) => ({ id: i + 1, djs: [], date: '2026-11-01' }));
  const sb = fakeClient(rows);
  // loadUpcomingRows uses fetchAllRows' defaults; pass through the default paging (1000 rows)
  const res = await loadUpcomingRows(sb, '2026-10-18');
  assert.equal(res.error, null);
  assert.equal(res.data.length, 2100);
  assert.ok(sb.orders.every(c => c === 'id'));
});

test('loadUpcomingRows reports a failed page (the caller must not publish)', async () => {
  const rows = Array.from({ length: 2100 }, (_, i) => ({ id: i + 1, djs: [] }));
  const res = await loadUpcomingRows(fakeClient(rows, { failFrom: 1000 }), '2026-10-18');
  assert.ok(res.error);
  assert.equal(res.failedAt, 1000);
  assert.equal(res.data.length, 1000);
});

test('djNamesFromRows: one entry per DJ key, first spelling wins', () => {
  const names = djNamesFromRows([
    { djs: ['Amelie Lens', 'KI/KI'] },
    { djs: ['amelie lens', 'Ki Ki'] },
    { djs: [] },
    {},
  ]);
  assert.equal(names.get('amelielens'), 'Amelie Lens');
  assert.equal(names.size, 2);
});
