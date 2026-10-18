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
