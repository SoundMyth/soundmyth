/**
 * SoundMyth – one-shot / recurring cleanup of mislabelled junk events.
 *
 * Removes future events that are tagged 'festival' but are clearly NOT festivals:
 *   a) the "venue" only repeats the event title (Bandsintown artist listings, e.g.
 *      "Tomorrowland and Dimitri Vegas & Like Mike"), with ≤1 act, or
 *   b) store / merch listings ("Tomorrowland Store").
 *
 * The scrapers now skip creating (a) at the source; this also clears rows that were
 * ingested before that fix. Runs in CI after dedupe. Set DRY=1 to preview only.
 *
 * Usage: node cleanup-junk.js   (DRY=1 node cleanup-junk.js to preview)
 */
import { createClient }  from '@supabase/supabase-js';
import { config }        from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '.env') });

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SB_URL || !SB_KEY) { console.error('❌  Missing SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1); }
const sb    = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const TODAY = new Date().toISOString().split('T')[0];

function isJunk(e) {
  const name = (e.name || '').trim(), venue = (e.venue || '').trim();
  const djs = e.djs || [], tags = e.tags || [];
  if (!tags.includes('festival')) return false;   // only ever touch festival-tagged rows
  if (djs.length > 1) return false;                // real festivals have many acts
  if (venue && venue === name) return true;        // a) venue just repeats the title
  if (/\bstore\b/i.test(name) || /\bstore\b/i.test(venue)) return true;  // b) store listing
  return false;
}

let rows = [], from = 0;
while (true) {
  const { data, error } = await sb.from('events')
    .select('id,name,venue,djs,tags,city,date').gte('date', TODAY).order('date').range(from, from + 999);
  if (error) { console.error(error.message); process.exit(1); }
  rows = rows.concat(data); if (data.length < 1000) break; from += 1000;
}

const junk = rows.filter(isJunk);
console.log(`Scanned ${rows.length} future events · junk to remove: ${junk.length}`);
junk.slice(0, 40).forEach(e => console.log(`  - ${e.date} ${JSON.stringify(e.name)} @ ${JSON.stringify(e.venue)} [${e.city}]`));

if (process.env.DRY === '1') { console.log('DRY run — nothing deleted.'); process.exit(0); }

let deleted = 0;
for (let i = 0; i < junk.length; i += 100) {
  const ids = junk.slice(i, i + 100).map(e => e.id);
  const { error } = await sb.from('events').delete().in('id', ids);
  if (error) console.error('  ❌ delete:', error.message); else deleted += ids.length;
}
console.log(`✓ Deleted ${deleted} junk events.`);
process.exit(0);
