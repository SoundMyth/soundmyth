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
import { readFileSync }  from 'fs';
import { config }        from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { canonCity, djNorm, buildDjCanon } from './normalize.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '.env') });

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SB_URL || !SB_KEY) { console.error('❌  Missing SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1); }
const sb    = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const TODAY = new Date().toISOString().split('T')[0];

// Our curated EDM universe — every event must tie to one of OUR DJs / clubs / festivals.
const readJ = p => { try { return JSON.parse(readFileSync(resolve(__dirname, p), 'utf8')); } catch { return []; } };
const DJ_SET   = new Set(readJ('data/artists_all.json').map(a => djNorm(a.name)));
const CLUB_SET = new Set(readJ('data/clubs_all.json').map(c => djNorm(c.name)));

// A Resident-Advisor event with no DJ from our list, not a curated club, and not a
// festival = off-genre noise (rock/random parties from area discovery). SoundMyth is
// EDM-only and built around our DJ list → drop it.
function nonCurated(e) {
  if (e.source !== 'ra') return false;
  if ((e.tags || []).includes('festival')) return false;
  if ((e.djs || []).some(d => DJ_SET.has(djNorm(d)))) return false;
  if (e.venue && CLUB_SET.has(djNorm(e.venue))) return false;
  return true;
}

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
    .select('id,name,venue,djs,tags,city,date,img_url,source').gte('date', TODAY).order('date').range(from, from + 999);
  if (error) { console.error(error.message); process.exit(1); }
  rows = rows.concat(data); if (data.length < 1000) break; from += 1000;
}

const junkCount = rows.filter(isJunk).length, ncCount = rows.filter(nonCurated).length;
const toRemove = rows.filter(e => isJunk(e) || nonCurated(e));
console.log(`Scanned ${rows.length} future events · to remove: ${toRemove.length} (mislabelled ${junkCount} + non-curated RA ${ncCount})`);
toRemove.slice(0, 40).forEach(e => console.log(`  - ${e.date} ${JSON.stringify((e.name||'').slice(0,46))} [${e.source}] @ ${JSON.stringify(e.venue)}`));

if (process.env.DRY === '1') { console.log('DRY run — nothing deleted.'); process.exit(0); }

let deleted = 0;
for (let i = 0; i < toRemove.length; i += 100) {
  const ids = toRemove.slice(i, i + 100).map(e => e.id);
  const { error } = await sb.from('events').delete().in('id', ids);
  if (error) console.error('  ❌ delete:', error.message); else deleted += ids.length;
}
console.log(`✓ Deleted ${deleted} events.`);

const removedIds = new Set(toRemove.map(e => e.id));
const live = rows.filter(e => !removedIds.has(e.id));

// Canonicalize city on existing rows (rows not re-scraped keep their old spelling).
// canonCity applies aliases (Eivissa→Ibiza) AND transliteration (София→Sofiya, Wrocław→Wroclaw).
let cityFixed = 0;
for (const e of live) {
  const nc = canonCity(e.city);
  if (nc && nc !== e.city) {
    const { error } = await sb.from('events').update({ city: nc }).eq('id', e.id);
    if (error) console.error(`  ❌ city ${e.id}:`, error.message);
    else { cityFixed++; if (cityFixed <= 30) console.log(`  city: ${JSON.stringify(e.city)} → ${nc}`); }
  }
}
console.log(`✓ Canonicalized city on ${cityFixed} rows.`);

// Canonicalize DJ names on existing rows (data-driven; collapse case/diacritic
// variants like alok/Alok, BLOND:ISH/Blond:ish, AME/Amè). Skips just-deleted junk.
const djCanon = buildDjCanon(live);
let djFixed = 0;
for (const e of live) {
  const djs = e.djs || [];
  if (!djs.length) continue;
  const nd = [...new Set(djs.map(d => djCanon[djNorm(d)] || d))];
  if (JSON.stringify(nd) !== JSON.stringify(djs)) {
    const { error } = await sb.from('events').update({ djs: nd }).eq('id', e.id);
    if (error) console.error(`  ❌ djs ${e.id}:`, error.message); else djFixed++;
  }
}
console.log(`✓ Canonicalized DJ names on ${djFixed} rows.`);

// Fill missing images by reusing a real photo the same artist has on another event.
const djImg = {};
for (const e of live) { if (!e.img_url) continue; for (const d of (e.djs || [])) { const k = djNorm(d); if (k && !djImg[k]) djImg[k] = e.img_url; } }
let imgFixed = 0;
for (const e of live) {
  if (e.img_url) continue;
  let img = null;
  for (const d of (e.djs || [])) { const c = djImg[djNorm(d)]; if (c) { img = c; break; } }
  if (!img) continue;
  const { error } = await sb.from('events').update({ img_url: img }).eq('id', e.id);
  if (error) console.error(`  ❌ img ${e.id}:`, error.message); else imgFixed++;
}
console.log(`✓ Filled images (artist-photo reuse) on ${imgFixed} rows.`);
process.exit(0);
