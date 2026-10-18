// lib/ra.js raQuery: the "data or null" policy used by the festival lookups.
// fetch is stubbed, so these tests never touch ra.co.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { raQuery, raPost, RA_GQL } from '../lib/ra.js';

const realFetch = globalThis.fetch;
let stub;
beforeEach(() => { stub = null; globalThis.fetch = async (...args) => stub(...args); });
afterEach(() => { globalThis.fetch = realFetch; });

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('posts to the RA GraphQL endpoint with query and variables', async () => {
  let seen;
  stub = async (url, init) => { seen = { url, init, body: JSON.parse(init.body) }; return json({ data: { ok: 1 } }); };
  await raPost('query Q { x }', { a: 1 });
  assert.equal(seen.url, RA_GQL);
  assert.equal(seen.init.method, 'POST');
  assert.deepEqual(seen.body, { query: 'query Q { x }', variables: { a: 1 } });
});

test('raQuery returns the data object on success', async () => {
  stub = async () => json({ data: { search: [] } });
  assert.deepEqual(await raQuery('q', {}), { search: [] });
});

test('raQuery returns null when the response carries GraphQL errors', async () => {
  stub = async () => json({ data: { partial: true }, errors: [{ message: 'nope' }] });
  assert.equal(await raQuery('q', {}), null);
});

test('raQuery returns null on HTTP error', async () => {
  stub = async () => json({ message: 'throttled' }, 429);
  assert.equal(await raQuery('q', {}), null);
});

test('raQuery returns null on network failure', async () => {
  stub = async () => { throw new TypeError('fetch failed'); };
  assert.equal(await raQuery('q', {}), null);
});
