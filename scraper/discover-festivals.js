/**
 * SoundMyth – discover festivals that are NOT yet in data/festivals_all.json.
 *
 * Why: festivals only enter the system through the curated list, so a festival
 * nobody typed in (EDC Colombia) is never scraped. This step closes that gap
 * every week, without manual work for the common cases.
 *
 * Three discovery paths, all against Resident Advisor (no secrets) + our DB:
 *
 *  A. BRAND EDITIONS  — data/festival_brands.json lists touring festival brands
 *     (EDC, Ultra, Tomorrowland, Creamfields…). Each brand is searched on RA;
 *     every upcoming edition whose title starts with a brand alias becomes a
 *     festival row (one per brand + city). Auto-added.
 *
 *  B. GENERIC RA FESTIVALS — a few keyword searches (Festival / Open Air /
 *     Weekender…). A hit is auto-added only when the title itself says festival
 *     AND ≥3 lineup artists AND ≥3 of them are in artists_all.json (the lineup
 *     is the quality signal; a title alone is not enough). Otherwise a candidate.
 *
 *  C. DB FESTIVAL-LIKE EVENTS — future events in the `events` table whose base
 *     title says festival/fest/open air/weekender and that are not in the list.
 *     Always written as candidates for review (never auto-added).
 *
 * Outputs
 *   data/festivals_all.json        — new rows appended (A + B only)
 *   data/festivals_candidates.json — everything else, with status pending | added | rejected.
 *                                    A human sets status "rejected" to stop it coming back.
 *   data/run-stats.json            — merged key `festivals: { added: [names], candidates: N }`
 *
 * Flags: --dry-run (or DRY_RUN=1) writes nothing; prints what would change.
 * Reads Supabase with the anon key (SUPABASE_URL + SUPABASE_ANON_KEY, or the
 * SB_URL/SB_KEY literals in ../index.html for local runs). Never writes the DB.
 *
 * Usage: node discover-festivals.js [--dry-run]
 */
import { createClient }                       from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath }                      from 'url';
import { dirname, resolve }                   from 'path';
import { canonCity, canonCountry }            from './normalize.js';
import { withRetry }                          from './http.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = p => resolve(__dirname, 'data', p);
const readJ = (p, fb = []) => { try { return JSON.parse(readFileSync(DATA(p), 'utf8')); } catch { return fb; } };
const DRY_RUN = process.argv.includes('--dry-run') || process.env.DRY_RUN === '1';
const TODAY   = new Date().toISOString().split('T')[0];
const sleep   = ms => new Promise(r => setTimeout(r, ms));

const DELAY        = 950;   // ms between RA calls (same politeness as scrape-festivals-ra.js)
const MAX_DETAIL   = 80;    // cap RA event-detail calls per run
const MIN_ARTISTS  = 3;     // generic auto-add: lineup size
const MIN_KNOWN    = 3;     // generic auto-add: lineup members in artists_all.json

// ── Supabase (anon, read-only) ───────────────────────────────────────────────
let SB_URL = process.env.SUPABASE_URL, SB_KEY = process.env.SUPABASE_ANON_KEY;
if (!SB_URL || !SB_KEY) {
  try {
    const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
    SB_URL = SB_URL || (html.match(/SB_URL\s*=\s*['"]([^'"]+)['"]/) || [])[1];
    SB_KEY = SB_KEY || (html.match(/SB_KEY\s*=\s*['"]([^'"]+)['"]/) || [])[1];
  } catch { /* no index.html: DB pass is skipped below */ }
}

// ── RA GraphQL (same request shape as scrape-festivals-ra.js / discover-djs.js) ──
const RA_GQL = 'https://ra.co/graphql';
const RA_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Referer': 'https://ra.co/', 'Origin': 'https://ra.co',
  'Accept': 'application/json', 'Accept-Language': 'en-US,en;q=0.9',
};
const SEARCH_Q = `query Search($term: String!) { search(searchTerm: $term, indices: [EVENT], limit: 10) { id value areaName date } }`;
const EVENT_Q  = `query Event($id: ID!) { event(id: $id) { id title date contentUrl venue { name area { name country { name } } } artists { name } } }`;

async function gql(query, variables) {
  try {
    const res = await fetch(RA_GQL, { method: 'POST', headers: RA_HEADERS,
      body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.errors ? null : (json?.data ?? null);
  } catch { return null; }
}

// ── helpers ───────────────────────────────────────────────────────────────────
const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/&/g, ' and ').replace(/['’`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const djKey = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '');
const FEST_WORD = /\b(festival|fest|open air|weekender|carnival|music and arts|music & arts)\b/i;

/** Festival base name = title without dates, years, "@ venue", "| x", "presents …". */
function baseName(title) {
  let t = (title || '').split(/\s+@\s+|\s+\|\s+|\s+[–—-]\s+|\s+presents\b|:|\(|,/i)[0];
  t = t.replace(/\b(19|20)\d{2}\b/g, ' ').replace(/\s+/g, ' ').replace(/[\s\-–—,]+$/, '').trim();
  if (t && t === t.toUpperCase() && /[A-Z]{3,}/.test(t)) t = t.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  return t;
}

/** Which curated brand (if any) an RA title belongs to. */
function matchBrand(title, brands) {
  const nt = norm(title);
  for (const b of brands) {
    if (b.exclude && new RegExp(b.exclude, 'i').test(title)) continue;
    for (const a of b.aliases) {
      const na = norm(a);
      if (nt === na || nt.startsWith(na + ' ')) return b;
    }
  }
  return null;
}

// ── load state ───────────────────────────────────────────────────────────────
const festivals  = readJ('festivals_all.json');
const brands     = readJ('festival_brands.json');
const LIST       = new Set(readJ('artists_all.json').map(a => djKey(a.name)));
let   candidates = readJ('festivals_candidates.json');
const candByKey  = new Map(candidates.map(c => [c.key, c]));
const existingNames = new Set(festivals.map(f => norm(f.name)));
// "New York City" / "New York" / "Mexico City" compare equal on the bare city word.
const cityKey = c => norm(canonCity(c || '')).replace(/\s+city$/, '');
// brand+city of existing rows: avoids adding "Time Warp Germany" next to "Time Warp" Mannheim
const existingBrandCity = new Set();
for (const f of festivals) {
  const b = matchBrand(f.name, brands);
  if (b) existingBrandCity.add(`${b.brand}|${cityKey(f.city)}`);
}
let maxRank = Math.max(0, ...festivals.map(f => f.ranking || 0));

const added = [];      // { name, city, country, date, via }
const pending = [];    // new candidate records
let searchesOk = 0, detailCalls = 0;

async function fetchDetail(id) {
  if (detailCalls >= MAX_DETAIL) return null;
  detailCalls++;
  await sleep(DELAY);
  const d = await gql(EVENT_Q, { id });
  return d?.event || null;
}

/** Decide one RA hit. kind: 'brand' | 'generic'. */
async function handleHit(hit, kind, brand) {
  const title = hit.value || '';
  const base  = baseName(title);
  const key   = norm(base);
  if (!key || key.length < 4) return;
  if (existingNames.has(key)) return;                    // already in the list
  if (candByKey.has(key)) return;                        // already a candidate / rejected / added
  const ev = await fetchDetail(hit.id);
  if (!ev) return;                                       // RA error: retry next run
  const date = String(ev.date || hit.date || '').split('T')[0];
  if (!date || date < TODAY) return;
  const country = canonCountry(ev.venue?.area?.country?.name || '');
  // RA's area is sometimes the country itself ("Croatia", "Netherlands") or "All": not a city.
  let city = canonCity(hit.areaName && hit.areaName !== 'All' ? hit.areaName : (ev.venue?.area?.name || ''));
  if (!city || norm(city) === norm(country)) city = '';
  const lineup  = (ev.artists || []).map(a => a.name).filter(Boolean);
  const known   = lineup.filter(n => LIST.has(djKey(n))).length;

  const rec = { key, name: base, city, country, date, ra_id: hit.id, via: kind,
    artists: lineup.length, known_artists: known, first_seen: TODAY };

  let autoOk, reason;
  if (kind === 'brand') {
    const bc = `${brand.brand}|${cityKey(city)}`;
    autoOk = !!(city && country) && !existingBrandCity.has(bc);
    reason = !city || !country ? 'city/country unknown' : existingBrandCity.has(bc) ? 'same brand+city already listed' : 'brand edition';
    if (autoOk) rec.brand = brand.brand;
  } else {
    const keyword = FEST_WORD.test(base);
    autoOk = keyword && lineup.length >= MIN_ARTISTS && known >= MIN_KNOWN && !!(city && country);
    reason = !keyword ? 'title has no festival keyword'
      : lineup.length < MIN_ARTISTS ? `only ${lineup.length} listed artists`
      : known < MIN_KNOWN ? `only ${known} lineup artists in artists_all`
      : !city || !country ? 'city/country unknown' : 'festival-like, strong lineup';
  }

  if (autoOk) {
    maxRank += 1;
    const row = { ranking: maxRank, name: base, city, country, website: '', date_raw: date,
      style: kind === 'brand' ? brand.style : 'Multi-genre', discovered: TODAY };
    festivals.push(row);
    existingNames.add(key);
    existingBrandCity.add(kind === 'brand' ? `${brand.brand}|${cityKey(city)}` : `generic|${cityKey(city)}`);
    rec.status = 'added';
    rec.reason = reason;
    candByKey.set(key, rec); candidates.push(rec);
    added.push({ name: base, city, country, date, via: kind });
    console.log(`  + ADD ${base} · ${city}, ${country} · ${date} [${kind}]`);
  } else {
    rec.status = 'pending';
    rec.reason = reason;
    candByKey.set(key, rec); candidates.push(rec); pending.push(rec);
    console.log(`  ? candidate ${base} · ${city || '?'}, ${country || '?'} · ${date} — ${reason}`);
  }
}

async function main() {
  console.log(`Festival discovery ${DRY_RUN ? '(DRY RUN — no files written)' : ''} · today ${TODAY}`);
  console.log(`List: ${festivals.length} festivals · brands: ${brands.length} · artists_all: ${LIST.size}`);

  // ── A. brand editions ─────────────────────────────────────────────────────
  const seenIds = new Set();
  const hitsA = [];
  for (const b of brands) {
    for (const alias of b.aliases) {
      const data = await gql(SEARCH_Q, { term: alias });
      if (data?.search) searchesOk++;
      await sleep(DELAY);
      for (const h of (data?.search || [])) {
        if (seenIds.has(h.id) || !h.date || String(h.date).split('T')[0] < TODAY) continue;
        if (!matchBrand(h.value || '', [b])) continue;
        seenIds.add(h.id); hitsA.push({ h, b });
      }
    }
  }
  console.log(`\n[A] brand editions: ${hitsA.length} upcoming RA hits across ${brands.length} brands`);
  for (const { h, b } of hitsA) await handleHit(h, 'brand', b);

  // ── B. generic festival-like RA searches ─────────────────────────────────
  const GENERIC = ['Festival 2026', 'Festival 2027', 'Open Air 2027', 'Weekender 2027', 'Music Festival 2027'];
  const hitsB = [];
  for (const term of GENERIC) {
    const data = await gql(SEARCH_Q, { term });
    if (data?.search) searchesOk++;
    await sleep(DELAY);
    for (const h of (data?.search || [])) {
      if (seenIds.has(h.id) || !h.date || String(h.date).split('T')[0] < TODAY) continue;
      if (!FEST_WORD.test(h.value || '')) continue;
      if (matchBrand(h.value || '', brands)) continue;   // brand path owns these
      seenIds.add(h.id); hitsB.push(h);
    }
  }
  console.log(`\n[B] generic festival-like RA hits: ${hitsB.length}`);
  for (const h of hitsB) await handleHit(h, 'generic', null);

  // ── C. DB festival-like events (candidates only) ─────────────────────────
  if (SB_URL && SB_KEY) {
    try {
      const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
      let rows = [], from = 0;
      while (true) {
        const { data, error } = await withRetry(
          () => sb.from('events').select('name,djs,city,country,date').gte('date', TODAY).range(from, from + 999),
          `Load events page (from=${from})`, 3, 3000);
        if (error || !data) { console.warn('  ⚠  DB read failed — skipping DB pass'); rows = null; break; }
        rows = rows.concat(data); if (data.length < 1000) break; from += 1000;
      }
      if (rows) {
        const groups = new Map();
        for (const e of rows) {
          const base = baseName(e.name);
          const k = norm(base);
          if (!k || !FEST_WORD.test(base) || existingNames.has(k) || candByKey.has(k)) continue;
          let g = groups.get(k);
          if (!g) { g = { base, events: 0, djs: new Set(), cities: {}, countries: {} }; groups.set(k, g); }
          g.events++;
          for (const d of (e.djs || [])) if (LIST.has(djKey(d))) g.djs.add(djKey(d));
          if (e.city) g.cities[e.city] = (g.cities[e.city] || 0) + 1;
          if (e.country) g.countries[e.country] = (g.countries[e.country] || 0) + 1;
        }
        const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
        const list = [...groups.entries()].sort((a, b) => b[1].djs.size - a[1].djs.size).slice(0, 100);
        for (const [k, g] of list) {
          const rec = { key: k, name: g.base, city: top(g.cities), country: top(g.countries),
            via: 'db', events_in_db: g.events, known_artists: g.djs.size,
            status: 'pending', reason: 'DB festival-like title; needs review', first_seen: TODAY };
          candByKey.set(k, rec); candidates.push(rec); pending.push(rec);
        }
        console.log(`\n[C] DB festival-like titles not in list: ${list.length} (scanned ${rows.length} future events)`);
      }
    } catch (err) { console.warn('  ⚠  DB pass error:', err.message || err); }
  } else {
    console.log('\n[C] skipped — no Supabase URL/anon key available');
  }

  // ── Summary + writes ──────────────────────────────────────────────────────
  const pendingCount = candidates.filter(c => c.status === 'pending').length;
  console.log(`\nSummary: searches ok ${searchesOk} · RA detail calls ${detailCalls} · added ${added.length} · pending candidates ${pendingCount}`);
  if (added.length) added.forEach(a => console.log(`  + ${a.name} (${a.city}, ${a.country}) ${a.date}`));
  pending.filter(c => c.via === 'db').slice(0, 25)
    .forEach(c => console.log(`  ? db ${c.name} · ${c.city || '?'}, ${c.country || '?'} · ${c.events_in_db} events · ${c.known_artists} listed DJs`));

  if (DRY_RUN) { console.log('\nDRY RUN: nothing written.'); return; }

  if (searchesOk === 0) {
    console.warn('⚠  RA returned nothing for every search (throttled or down). Files left untouched.');
    return;
  }
  if (added.length) writeFileSync(DATA('festivals_all.json'), JSON.stringify(festivals, null, 2) + '\n');
  writeFileSync(DATA('festivals_candidates.json'), JSON.stringify(candidates, null, 2) + '\n');
  const statsPath = DATA('run-stats.json');
  const stats = existsSync(statsPath) ? readJ('run-stats.json', {}) : {};
  stats.festivals = { added: added.map(a => a.name), candidates: pendingCount };
  writeFileSync(statsPath, JSON.stringify(stats, null, 2) + '\n');
  console.log('Wrote festivals_all.json (if changed), festivals_candidates.json, run-stats.json');
}

main().then(() => process.exit(0)).catch(err => { console.error('Fatal:', err); process.exit(1); });
