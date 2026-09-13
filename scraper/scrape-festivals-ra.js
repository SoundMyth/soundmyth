/**
 * SoundMyth – Resident Advisor Festival Scraper
 *
 * Covers the festivals that have no Songkick source: Songkick retired its
 * festival search (type=festival now 301s to an untyped search whose results
 * are venues/artists, never festivals), so those entries can only be reached
 * through their own website or RA. RA also returns a full lineup, which the
 * direct-website scraper cannot extract.
 *
 * RA search is fuzzy — "Triip Festival" happily returns "Heave Festival" — so a
 * match is only accepted when the event title starts with the festival name AND
 * the RA area agrees with the curated city/country. Without the location check,
 * every "Time Warp" row would collect Time Warp Mexico and Time Warp NYC.
 *
 * Usage: node scrape-festivals-ra.js
 */

import { createClient }  from '@supabase/supabase-js';
import { readFileSync }  from 'fs';
import { config }        from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { cleanEvent, canonCity, canonCountry } from './normalize.js';
import { withRetry } from './http.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '.env') });

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
const TODAY  = new Date().toISOString().split('T')[0];
const DELAY  = 950;   // ms between RA requests
const BATCH  = 50;

if (!SB_URL || !SB_KEY) { console.error('❌  Missing Supabase env vars'); process.exit(1); }

const sb    = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const FESTIVALS_PATH = resolve(__dirname, 'data/festivals_all.json');

// ── RA GraphQL ────────────────────────────────────────────────────────────────
const RA_GQL = 'https://ra.co/graphql';
const RA_HEADERS = {
  'Content-Type':    'application/json',
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Referer':         'https://ra.co/',
  'Origin':          'https://ra.co',
  'Accept':          'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

const SEARCH_QUERY = `
query Search($term: String!) {
  search(searchTerm: $term, indices: [EVENT], limit: 10) {
    id value areaName date
  }
}`;

const EVENT_QUERY = `
query Event($id: ID!) {
  event(id: $id) {
    id title date contentUrl
    venue { name area { name country { name } } }
    artists { name }
  }
}`;

async function gql(query, variables) {
  try {
    const res = await fetch(RA_GQL, {
      method:  'POST',
      headers: RA_HEADERS,
      body:    JSON.stringify({ query, variables }),
      signal:  AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.errors ? null : json?.data;
  } catch { return null; }
}

// ── Matching ─────────────────────────────────────────────────────────────────
const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/&/g, ' and ').replace(/['’`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// The curated festival list uses Spanish exonyms that canonCity() doesn't fold,
// which would otherwise reject correct hits (Ultra Japan "Tokio" vs RA "Tokyo").
const CITY_EXONYM = {
  'tokio': 'tokyo', 'nueva york': 'new york', 'singapur': 'singapore',
  'djakarta': 'jakarta', 'ciudad de mexico': 'mexico city', 'moscu': 'moscow',
  'santiago de chile': 'santiago', 'ciudad del cabo': 'cape town',
  'johannesburgo': 'johannesburg', 'bombay': 'mumbai', 'ginebra': 'geneva',
};
const city = c => { const n = norm(canonCity(c || '')); return CITY_EXONYM[n] || n; };

/** RA title must equal the festival name or extend it at a word boundary. */
function nameMatches(festName, raValue) {
  const fn = norm(festName), rv = norm(raValue);
  if (!fn || fn.length < 4) return false;
  return rv === fn || rv.startsWith(fn + ' ');
}

/** RA area must name the same city, or the festival's country. */
function locMatches(festCity, festCountry, raArea) {
  if (!raArea) return false;
  const area = city(raArea), rawArea = norm(raArea);
  const fCity = city(festCity);
  const fCountry = norm(canonCountry(festCountry || ''));
  if (fCity && (area === fCity || area.includes(fCity) || fCity.includes(area))) return true;
  if (fCountry && (rawArea.includes(fCountry) || fCountry.includes(rawArea))) return true;
  return false;
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  const festivals = JSON.parse(readFileSync(FESTIVALS_PATH, 'utf8'));
  // Festivals WITH sk_url already have a Songkick path; querying RA for them too
  // would only add cross-source near-duplicates.
  const todo = festivals.filter(f => !f.sk_url && f.name);

  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  SoundMyth – Resident Advisor Festival Scraper   ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`\n📋  Festivals to try : ${todo.length}  (no Songkick URL)`);
  console.log(`🗓  Cutoff date      : ${TODAY}\n`);
  console.log('─'.repeat(60));

  let found = 0, rejected = 0, none = 0, upserted = 0;
  const events = [];

  for (let i = 0; i < todo.length; i++) {
    const fest = todo[i];
    const pct  = String(Math.round(((i + 1) / todo.length) * 100)).padStart(3);
    process.stdout.write(`[${String(i+1).padStart(3)}/${todo.length}] ${pct}% │ ${fest.name.slice(0,32).padEnd(32)} `);

    const data = await gql(SEARCH_QUERY, { term: fest.name });
    const hits = (data?.search || []).filter(r => r.date && String(r.date).split('T')[0] >= TODAY);

    if (!hits.length) { process.stdout.write('–  no RA results\n'); none++; await sleep(DELAY); continue; }

    const named   = hits.filter(r => nameMatches(fest.name, r.value));
    const matched = named.filter(r => locMatches(fest.city, fest.country, r.areaName));

    if (!matched.length) {
      process.stdout.write(named.length ? `✗  ${named.length} name-only, wrong location\n` : '–  no name match\n');
      rejected += named.length;
      await sleep(DELAY);
      continue;
    }

    const names = [];
    for (const hit of matched) {
      await sleep(DELAY);
      const det = await gql(EVENT_QUERY, { id: hit.id });
      const ev  = det?.event;
      if (!ev) continue;
      const date = String(ev.date || hit.date).split('T')[0];
      if (date < TODAY) continue;

      events.push({
        name:       ev.title || hit.value,
        venue:      ev.venue?.name || '',
        // The curated city is more reliable than RA's area, which is often a
        // country ("Thailand") or the literal string "All".
        city:       fest.city    || ev.venue?.area?.name || '',
        country:    ev.venue?.area?.country?.name || fest.country || '',
        date,
        djs:        (ev.artists || []).map(a => a.name).filter(Boolean),
        genre:      'Electronic',
        tags:       ['festival', 'ra'],
        price:      '',
        ticket_url: ev.contentUrl ? `https://ra.co${ev.contentUrl}` : '',
        img_url:    '',
        source:     'ra',
        source_id:  `ra_${ev.id}`,
      });
      names.push(`${date}`);
      found++;
    }
    process.stdout.write(names.length ? `✓  ${names.join(', ')}\n` : '–  detail fetch failed\n');
    await sleep(DELAY);
  }

  // Upsert in batches
  const seen = new Set();
  const batch = events.filter(e => { if (seen.has(e.source_id)) return false; seen.add(e.source_id); return true; });
  batch.forEach(cleanEvent);

  for (let i = 0; i < batch.length; i += BATCH) {
    const slice = batch.slice(i, i + BATCH);
    const { error } = await withRetry(
      () => sb.from('events').upsert(slice, { onConflict: 'source_id', ignoreDuplicates: false }),
      'Supabase upsert'
    );
    if (error) console.error('\n❌  Supabase:', error.message || error);
    else upserted += slice.length;
  }

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║  RA festival scrape complete                     ║');
  console.log(`║  Events found   : ${String(found).padEnd(30)}║`);
  console.log(`║  Wrong location : ${String(rejected).padEnd(30)}║`);
  console.log(`║  No RA results  : ${String(none).padEnd(30)}║`);
  console.log(`║  Total upserted : ${String(upserted).padEnd(30)}║`);
  console.log('╚══════════════════════════════════════════════════╝');

  if (batch.length) {
    console.log('\nEvents added:');
    batch.forEach(e => console.log(`  ✓ ${e.name.slice(0,38).padEnd(38)} ${e.date}  ${e.city}, ${e.country}  (${e.djs.length} artists)`));
  }
}

main().then(() => process.exit(0)).catch(err => { console.error('Fatal:', err); process.exit(1); });
