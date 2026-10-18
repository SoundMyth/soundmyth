/**
 * SoundMyth – Event Data Validator & Auto-Fixer
 *
 * Runs over every future event each week and fixes/drops what the scrapers got wrong:
 *  - geography (contract §6): canonical city/country, sub-areas folded, RA "All" areas and
 *    empty cities filled from clubs_all.json, hub-city country mismatches corrected only when
 *    the venue is known to be in the hub country (otherwise flagged), country names canonical.
 *  - dates (contract §5): events more than 15 months ahead are dropped; legacy website rows
 *    (pre-fix "Friday November 20th 2026 - …" names) are dropped so they are re-scraped clean.
 *  - lineups: junk names removed, b2b split (normalize.cleanLineup).
 *  - events still lacking city or country after every fallback are DROPPED and counted.
 * Stats go to data/run-stats.json (section "validate") for steps/17-report.js.
 *
 * Usage: node steps/12-validate.js
 */

import { STYLES, FALLBACK_GENRE } from '../lib/genres.js';
import { makeClient, loadEnv, fetchAllRows } from '../lib/db.js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync, existsSync } from 'fs';
import { withRetry } from '../lib/http.js';
import {
  resolveGeo, makeClubLookup, cleanLineup, checkEventDate, todayISO,
  isLegacyWebsiteRow, cityKey, HUB_COUNTRY,
} from '../lib/normalize.js';
import { writeRunStat } from '../lib/run-stats.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv();

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SB_URL || !SB_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

const sb = makeClient(SB_URL, SB_KEY);

// Valid event genres: the 16 canonical styles + the festival/event fallback.
const CANON_GENRE = new Set([...STYLES, FALLBACK_GENRE]);

const clubsPath = resolve(__dirname, '../data/clubs_all.json');
const clubLookup = makeClubLookup(existsSync(clubsPath) ? JSON.parse(readFileSync(clubsPath, 'utf8')) : []);

// ── Helpers ──────────────────────────────────────────────────────────────────

function isEmpty(val) {
  if (val === null || val === undefined) return true;
  if (typeof val === 'string') return val.trim().length === 0;
  return false;
}

function isDJatVenuePattern(name) {
  if (!name) return false;
  return /^.+\s+(at|@)\s+.+$/i.test(name.trim());
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('==================================================');
  console.log('  SoundMyth - Event Data Validator');
  console.log('==================================================\n');

  const today = todayISO();
  console.log(`Date        : ${today}`);
  console.log(`Fetching future events (date >= ${today})...\n`);

  // ── Fetch all future events (paginated) ──────────────────────────────────
  // On a failed page, carry on with the rows loaded so far (the original policy, kept on purpose).
  const { data: allEvents, error: fetchErr } = await fetchAllRows(
    (from, to) => sb
      .from('events')
      .select('id, name, venue, city, country, date, djs, tags, source, source_id, genre, ticket_url, img_url, price')
      .gte('date', today)
      .range(from, to)
      .order('date', { ascending: true }));
  if (fetchErr) console.error('  Fetch error:', fetchErr.message || fetchErr);

  console.log(`Total future events: ${allEvents.length}\n`);

  if (allEvents.length === 0) {
    console.log('No future events found. Nothing to validate.');
    return;
  }

  // ── Geo / date / lineup pass (pure decisions, DB writes below) ───────────
  const stats = {
    future: allEvents.length,
    cityCanonicalized: 0, cityFromVenue: 0, countryFilled: 0,
    hubCountryFixed: 0, djListsCleaned: 0,
    droppedNoGeo: 0, droppedDate: 0, droppedLegacyWebsite: 0,
  };
  const dropNoGeo = [], dropDate = [], dropLegacy = [];
  const updates = [];          // {id, patch}
  const keptGeo = [];          // post-fix {city,country} for the flag scan
  const hubFlags = [];         // hub city listed under a country we could not verify

  for (const ev of allEvents) {
    if (isLegacyWebsiteRow(ev)) { dropLegacy.push(ev); continue; }

    const dateStatus = checkEventDate(ev.date, today);
    if (dateStatus === 'too-far' || dateStatus === 'invalid') { dropDate.push(ev); continue; }

    const g = resolveGeo(ev, clubLookup);
    if (!g.city || !g.country) { dropNoGeo.push(ev); continue; }

    if (g.cityChanged) stats.cityCanonicalized++;
    if (g.cityFallback) stats.cityFromVenue++;
    if (g.countryFilled) stats.countryFilled++;
    if (g.hubFixed) stats.hubCountryFixed++;
    if (g.hubFlag) hubFlags.push({ id: ev.id, name: ev.name, venue: ev.venue, date: ev.date, flag: g.hubFlag });

    const djs = cleanLineup(ev.djs);
    const patch = {};
    if (g.city !== (ev.city || '')) patch.city = g.city;
    if (g.country !== (ev.country || '')) patch.country = g.country;
    if (JSON.stringify(djs) !== JSON.stringify(ev.djs || [])) { patch.djs = djs; stats.djListsCleaned++; }
    if (Object.keys(patch).length) updates.push({ id: ev.id, patch });
    keptGeo.push({ city: g.city, country: g.country });
  }

  stats.droppedNoGeo = dropNoGeo.length;
  stats.droppedDate = dropDate.length;
  stats.droppedLegacyWebsite = dropLegacy.length;

  // Cities that appear under more than one country (after fixes), excluding hubs: flagged, not changed.
  const countriesByCity = new Map();
  for (const { city, country } of keptGeo) {
    const k = cityKey(city);
    if (!countriesByCity.has(k)) countriesByCity.set(k, { city, countries: new Map() });
    const m = countriesByCity.get(k).countries;
    m.set(country, (m.get(country) || 0) + 1);
  }
  const multiCountry = [];
  for (const { city, countries } of countriesByCity.values()) {
    if (countries.size > 1 && !HUB_COUNTRY[city]) {
      multiCountry.push({ city, countries: [...countries].map(([c, n]) => `${c} (${n})`) });
    }
  }

  // ── Report ──────────────────────────────────────────────────────────────
  console.log('--------------------------------------------------');
  console.log('  VALIDATION REPORT');
  console.log('--------------------------------------------------\n');
  console.log(`[1] Dropped: no city or country after fallbacks : ${dropNoGeo.length}`);
  for (const ev of dropNoGeo.slice(0, 10)) console.log(`     - ${ev.date} | ${(ev.name || '').slice(0, 40)} | ${ev.source} | city "${ev.city || ''}" country "${ev.country || ''}"`);
  console.log(`\n[2] Dropped: date out of range (>15 months / invalid): ${dropDate.length}`);
  for (const ev of dropDate.slice(0, 10)) console.log(`     - ${ev.date} | ${(ev.name || '').slice(0, 40)}`);
  console.log(`\n[3] Dropped: legacy website rows (pre-fix format)  : ${dropLegacy.length}`);
  console.log(`\n[4] Geo flags: hub city listed under another country: ${hubFlags.length}`);
  for (const f of hubFlags.slice(0, 10)) console.log(`     - ${f.date} | ${f.name} | ${f.venue} | ${f.flag}`);
  console.log(`\n[5] Geo flags: city under several countries          : ${multiCountry.length}`);
  for (const f of multiCountry.slice(0, 10)) console.log(`     - ${f.city}: ${f.countries.join(', ')}`);

  // ── Auto-fixes ───────────────────────────────────────────────────────────
  console.log('\n--------------------------------------------------');
  console.log('  AUTO-FIXES');
  console.log('--------------------------------------------------\n');

  let fixedGenre = 0;

  // Fix 1: missing or non-canonical genre → 'Multi-genre' (steps/13-classify.js normally fixes these first)
  const missingGenre = allEvents.filter(ev => isEmpty(ev.genre) || !CANON_GENRE.has(ev.genre));
  console.log('Fix 1: Default genre to "Multi-genre" where missing/non-canonical...');
  for (const ev of missingGenre) {
    const { error } = await sb
      .from('events')
      .update({ genre: FALLBACK_GENRE })
      .eq('id', ev.id);

    if (error) {
      console.error(`  Error fixing genre for ${ev.id}: ${error.message}`);
    } else {
      fixedGenre++;
    }
  }
  console.log(`  Fixed: ${fixedGenre}\n`);

  // Fix 2: geo / lineup patches on kept rows
  console.log(`Fix 2: Geo + lineup patches on ${updates.length} rows...`);
  let patched = 0;
  for (const { id, patch } of updates) {
    const { error } = await sb.from('events').update(patch).eq('id', id);
    if (error) console.error(`  Error patching ${id}: ${error.message}`);
    else patched++;
  }
  console.log(`  Patched: ${patched}\n`);

  // Fix 3: drops (by id, in chunks)
  const toDrop = [...dropNoGeo, ...dropDate, ...dropLegacy].map(e => e.id);
  console.log(`Fix 3: Dropping ${toDrop.length} events...`);
  let dropped = 0;
  for (let i = 0; i < toDrop.length; i += 100) {
    const chunk = toDrop.slice(i, i + 100);
    const { error, count } = await withRetry(
      () => sb.from('events').delete({ count: 'exact' }).in('id', chunk),
      'Validate drop batch', 4, 5000
    );
    if (error) console.error(`  Drop error: ${error.message || error}`);
    else dropped += count || 0;
  }
  console.log(`  Dropped: ${dropped}\n`);

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('==================================================');
  console.log('  SUMMARY');
  console.log('==================================================');
  console.log(`  Future events              : ${allEvents.length}`);
  console.log(`  Cities canonicalized       : ${stats.cityCanonicalized}`);
  console.log(`  Cities filled from venue   : ${stats.cityFromVenue}`);
  console.log(`  Countries filled           : ${stats.countryFilled}`);
  console.log(`  Hub countries fixed        : ${stats.hubCountryFixed}`);
  console.log(`  Lineups cleaned            : ${stats.djListsCleaned}`);
  console.log(`  Dropped (no geo)           : ${dropNoGeo.length}`);
  console.log(`  Dropped (date range)       : ${dropDate.length}`);
  console.log(`  Dropped (legacy website)   : ${dropLegacy.length}`);
  console.log(`  Geo flags (hub / multi)    : ${hubFlags.length} / ${multiCountry.length}`);
  console.log('==================================================\n');

  writeRunStat('validate', {
    ...stats,
    dropped,
    fixedGenre,
    geoFlags: {
      hubMismatch: hubFlags.slice(0, 50),
      hubMismatchCount: hubFlags.length,
      multiCountryCities: multiCountry.slice(0, 50),
      multiCountryCount: multiCountry.length,
    },
    droppedSamples: dropNoGeo.slice(0, 20).map(e => ({ name: e.name, date: e.date, source: e.source, source_id: e.source_id })),
  });
}

main().then(() => process.exit(0)).catch(err => { console.error('Fatal:', err); process.exit(1); });
