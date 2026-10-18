/**
 * SoundMyth – shared Supabase helpers for the pipeline.
 *
 *   loadEnv()                  read scraper/.env for local runs (CI passes secrets as env vars)
 *   makeClient(url, key)       the one place that configures the supabase-js client
 *   fetchAllRows(makeQuery)    page a query past PostgREST's 1000-row cap, retrying each page
 *
 * Callers keep their own error policy: fetchAllRows returns the rows loaded so far
 * plus the error, and each step decides whether a partial load is fatal (deletes must
 * abort; a read-only report may continue).
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { withRetry } from './http.js';

const SCRAPER_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

export function loadEnv() {
  config({ path: join(SCRAPER_DIR, '.env') });
}

export function makeClient(url, key) {
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Load every row a query matches, one page at a time.
 * `makeQuery(from, to)` must return a fresh supabase query with .range(from, to) applied.
 * Returns { data, error, failedAt }: on a failed page, `data` holds the rows loaded before it.
 */
export async function fetchAllRows(makeQuery, { pageSize = 1000, retries = 5, delayMs = 5000 } = {}) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await withRetry(
      () => makeQuery(from, from + pageSize - 1),
      `Load events page (from=${from})`, retries, delayMs
    );
    if (error) return { data: rows, error, failedAt: from };
    rows.push(...data);
    if (data.length < pageSize) return { data: rows, error: null, failedAt: null };
  }
}

/**
 * Drop rows whose `id` was already seen, keeping the first occurrence. Offset paging without a
 * unique ORDER BY can return one row on two pages (and skip another); a delete must never see
 * the same row twice, so every step that acts on the rows dedupes them here first.
 */
export function uniqueById(rows) {
  const seen = new Set();
  const out = [];
  for (const r of rows || []) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

/**
 * saved_events ids whose event is gone (purge's orphan cleanup). `validEventIds` must be the
 * COMPLETE set of event ids. An empty set is never evidence: it means the events read returned
 * nothing, so no bookmark is treated as orphaned.
 */
export function orphanSavedIds(savedRows, validEventIds) {
  if (!validEventIds || validEventIds.size === 0) return [];
  return (savedRows || []).filter(s => !validEventIds.has(s.event_id)).map(s => s.id);
}

/**
 * Delete bookmarks (saved_events) whose event no longer exists. Any read error aborts the whole
 * step: a partial id set would make bookmarks of existing events look orphaned, and they are the
 * users' data. saved_events is read first, so a bookmark added during this run always has its
 * event in the later events read.
 */
export async function cleanOrphanSaved(sb, readOpts = {}) {
  const saved = await fetchAllRows(
    (from, to) => sb.from('saved_events').select('id, event_id').order('id').range(from, to), readOpts);
  if (saved.error) return { status: 'aborted', reason: `saved_events read failed at offset ${saved.failedAt}: ${saved.error.message || saved.error}`, found: 0, deleted: 0 };
  const events = await fetchAllRows(
    (from, to) => sb.from('events').select('id').order('id').range(from, to), readOpts);
  if (events.error) return { status: 'aborted', reason: `events read failed at offset ${events.failedAt}: ${events.error.message || events.error}`, found: 0, deleted: 0 };
  if (!events.data.length) return { status: 'skipped', reason: 'events read returned 0 rows', found: 0, deleted: 0 };

  const orphanIds = orphanSavedIds(saved.data, new Set(events.data.map(e => e.id)));
  let deleted = 0, failed = 0;
  for (let i = 0; i < orphanIds.length; i += 100) {
    const { error, count } = await withRetry(
      () => sb.from('saved_events').delete({ count: 'exact' }).in('id', orphanIds.slice(i, i + 100)),
      'Orphan delete batch'
    );
    if (error) { failed++; console.error('  ❌  Orphan delete error:', error.message || error); }
    else deleted += count || 0;
  }
  if (failed) return { status: 'partial', reason: `${failed} delete batch(es) failed`, found: orphanIds.length, deleted };
  return { status: 'ok', found: orphanIds.length, deleted };
}
