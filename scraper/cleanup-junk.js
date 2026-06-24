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
import { canonCity, canonCountry, canonStyle, djNorm, buildDjCanon } from './normalize.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '.env') });

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SB_URL || !SB_KEY) { console.error('❌  Missing SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1); }
const sb    = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const TODAY = new Date().toISOString().split('T')[0];

// Our DJ list is THE gate. An event belongs in SoundMyth only if an EDM DJ we
// recognise is on the bill — OR it's a festival (curated festivals may list their
// line-up later). The club/venue being "ours" is NOT a criterion.
//
// "EDM DJ we recognise" = curated list (data/artists_all.json) ∪ discovered DJs that
// verified as electronic on Resident Advisor (data/artists_candidates.json, onRA:true,
// produced by discover-djs.js). That way EDM DJs we don't track yet are kept (and stay
// reviewable in the candidates file) while genuine off-genre acts (rock/jazz) are dropped.
const readJ = p => { try { return JSON.parse(readFileSync(resolve(__dirname, p), 'utf8')); } catch { return []; } };
const djKey  = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '');
const ALLOW  = new Set(readJ('data/artists_allow.json').map(djKey));            // manual EDM rescue
const BLOCK  = new Set(readJ('data/artists_block.json').map(djKey));            // manual off-genre (RA false-positives)
const DJ_SET = new Set(readJ('data/artists_all.json').map(a => djKey(a.name)));
for (const c of readJ('data/artists_candidates.json')) if (c.onRA) DJ_SET.add(c.key || djKey(c.name));
for (const k of ALLOW) DJ_SET.add(k);
for (const k of BLOCK) DJ_SET.delete(k);   // block always wins over keep
// Off-genre acts (rock/pop/jazz that did NOT verify on RA: Gorillaz, The Cure…) —
// stripped from kept line-ups so the app only shows EDM names. ALLOW > BLOCK > onRA.
const OFF = new Set(readJ('data/artists_candidates.json').filter(c => c.onRA === false).map(c => c.key || djKey(c.name)));
for (const k of BLOCK) OFF.add(k);
for (const k of ALLOW) OFF.delete(k);

// Off-scope = not a festival AND no EDM DJ we recognise on the bill (rock/jazz/random
// parties). SoundMyth is EDM-only, driven by the list + RA-verified discoveries.
function offGenre(e) {
  if ((e.tags || []).includes('festival')) return false;
  if ((e.djs || []).some(d => DJ_SET.has(djKey(d)))) return false;
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

const junkCount = rows.filter(isJunk).length, ogCount = rows.filter(offGenre).length;
const toRemove = rows.filter(e => isJunk(e) || offGenre(e));
console.log(`Scanned ${rows.length} future events · to remove: ${toRemove.length} (mislabelled ${junkCount} + off-scope/no-DJ ${ogCount})`);
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

// Canonicalize country on existing rows (fold long-form variants the scrapers passed
// through: United States of America→United States, Czech Republic→Czechia, Korea,
// Republic Of→South Korea). The frontend already merges these on load; this keeps the
// raw DB consistent so the on-demand Clean DB run fully cleans it (not only validate.js).
let countryFixed = 0;
for (const e of live) {
  const nc = canonCountry(e.country);
  if (nc && nc !== e.country) {
    const { error } = await sb.from('events').update({ country: nc }).eq('id', e.id);
    if (error) console.error(`  ❌ country ${e.id}:`, error.message);
    else { countryFixed++; if (countryFixed <= 20) console.log(`  country: ${JSON.stringify(e.country)} → ${nc}`); }
  }
}
console.log(`✓ Canonicalized country on ${countryFixed} rows.`);

// Canonicalize DJ names on existing rows (data-driven; collapse case/diacritic
// variants like alok/Alok, BLOND:ISH/Blond:ish, AME/Amè) AND strip off-genre acts so
// the displayed line-up is EDM-only. Stripping never blanks a bill (festivals with a
// TBA / all-unverified line-up keep their djs). Skips just-deleted junk.
const djCanon = buildDjCanon(live);
let djFixed = 0, trimmed = 0;
for (const e of live) {
  const djs = e.djs || [];
  if (!djs.length) continue;
  let nd = [...new Set(djs.map(d => djCanon[djNorm(d)] || d))];
  const edm = nd.filter(d => !OFF.has(djKey(d)));     // drop rock/pop/jazz from the line-up
  if (edm.length && edm.length !== nd.length) { trimmed++; nd = edm; }   // never blank
  if (JSON.stringify(nd) !== JSON.stringify(djs)) {
    const { error } = await sb.from('events').update({ djs: nd }).eq('id', e.id);
    if (error) console.error(`  ❌ djs ${e.id}:`, error.message); else djFixed++;
  }
}
console.log(`✓ Canonicalized DJ names on ${djFixed} rows (off-genre acts trimmed from ${trimmed} line-ups).`);

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

// Stamp events.genre from the head-liner's style (data/artists_all.json) so the genre
// chip is meaningful and "styles" personalization works for every DJ — not just the
// ~100 in the frontend DJ_GENRE map. Only fills generic/empty genres; picks the first
// DJ on the bill with a real (non-Electronic) style.
const djStyle = {};
for (const a of readJ('data/artists_all.json')) { const k = djKey(a.name); if (k && !djStyle[k]) djStyle[k] = canonStyle(a.genre, a.subgenre); }
const GENERIC = new Set(['', 'electronic', 'edm', 'unknown', 'various', 'multi-genre', 'multigenre']);
let genreFixed = 0;
for (const e of live) {
  const cur = (e.genre || '').trim();
  let target = null;
  if (GENERIC.has(cur.toLowerCase())) {
    // generic/empty → fill from the first head-liner with a real style
    for (const d of (e.djs || [])) { const s = djStyle[djKey(d)]; if (s && s !== 'Electronic') { target = s; break; } }
  } else {
    // already-specific → fold verbose label into the clean bucket (Big Room / Festival
    // EDM → Big Room). Unknown labels map to 'Electronic' → left untouched (no clobber).
    const cs = canonStyle(cur);
    if (cs !== 'Electronic') target = cs;
  }
  if (target && target !== e.genre) {
    const { error } = await sb.from('events').update({ genre: target }).eq('id', e.id);
    if (error) console.error(`  ❌ genre ${e.id}:`, error.message);
    else { genreFixed++; if (genreFixed <= 20) console.log(`  genre: ${JSON.stringify((e.name||'').slice(0,30))} ${JSON.stringify(cur||'∅')} → ${target}`); }
  }
}
console.log(`✓ Normalized/stamped genre on ${genreFixed} rows.`);
process.exit(0);
