/**
 * SoundMyth – Supabase Event Purge
 *
 * Deletes events whose date is older than PURGE_DAYS_AGO days from today.
 * Events from the last PURGE_DAYS_AGO days are kept (shown greyed out on web).
 *
 * Usage: node steps/16-purge.js
 * Schedule: weekly (Sundays) via task scheduler
 */

import { withRetry } from '../lib/http.js';
import { makeClient, loadEnv, cleanOrphanSaved } from '../lib/db.js';
import { todayISO, addDaysISO } from '../lib/normalize.js';
import { writeRunStat } from '../lib/run-stats.js';

loadEnv();

const SB_URL  = process.env.SUPABASE_URL;
const SB_KEY  = process.env.SUPABASE_SERVICE_KEY;

if (!SB_URL || !SB_KEY) {
  console.error('❌  Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

const sb = makeClient(SB_URL, SB_KEY);

// ── CONFIG ────────────────────────────────────────────────────────────────────
const PURGE_DAYS_AGO = 8;    // contract §5: keep 8 days of past events (frontend shows last 7)

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  const today     = todayISO();
  const cutoffStr = addDaysISO(today, -PURGE_DAYS_AGO);

  console.log('╔══════════════════════════════════════════╗');
  console.log('║  SoundMyth – Supabase Event Purge        ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`\n🗓  Today       : ${today}`);
  console.log(`🗑  Purge before : ${cutoffStr}  (>${PURGE_DAYS_AGO} days ago)\n`);

  // Count first — use a generous retry budget: purge runs at the end of a 1.5h
  // scrape, when Supabase connections may be transiently exhausted.
  const { count, error: countErr } = await withRetry(
    () => sb.from('events').select('id', { count: 'exact', head: true }).lt('date', cutoffStr),
    'Count',
    5,
    5000
  );

  if (countErr) {
    console.error('❌  Count error:', countErr.message || countErr);
    process.exit(1);
  }

  console.log(`📊  Events to delete : ${count}`);

  if (!count || count === 0) {
    console.log('\n✅  Nothing to purge. DB is clean.');
    writeRunStat('purge', { cutoff: cutoffStr, retentionDays: PURGE_DAYS_AGO, deleted: 0 });
    return;
  }

  // Delete in batches of 1000 to avoid timeouts.
  // .limit(1000) is essential: without it, a single DELETE with no row limit could
  // time out on a large backlog and cause the step to exit(1), which blocks the
  // "Commit data files" step (purge has no continue-on-error in the workflow).
  let deleted = 0;
  while (true) {
    const { error: delErr, count: batchCount } = await withRetry(
      () => sb.from('events').delete({ count: 'exact' }).lt('date', cutoffStr).limit(1000),
      'Delete batch',
      5,
      5000
    );

    if (delErr) {
      console.error('❌  Delete error:', delErr.message || delErr);
      process.exit(1);
    }

    deleted += batchCount || 0;
    console.log(`  ✓ Batch deleted: ${batchCount}`);
    if (!batchCount || batchCount < 1000) break;
  }

  // Also purge orphan saved_events (user bookmarks pointing to deleted events).
  console.log('\n🧹  Checking orphan saved_events…');
  const orphans = await cleanOrphanSaved(sb);
  if (orphans.status === 'ok') console.log(`  ✓ Deleted ${orphans.deleted} of ${orphans.found} orphaned saved_events rows`);
  else console.log(`  ⚠  Orphan cleanup ${orphans.status}: ${orphans.reason}`);

  writeRunStat('purge', { cutoff: cutoffStr, retentionDays: PURGE_DAYS_AGO, deleted, orphanSavedEvents: orphans });

  console.log('\n╔══════════════════════════════════════════╗');
  console.log(`║  Purge complete  →  ${String(deleted).padEnd(18)} deleted ║`);
  console.log('╚══════════════════════════════════════════╝');
}

main().then(() => process.exit(0)).catch(err => { console.error('Fatal:', err); process.exit(1); });
