/**
 * SoundMyth – Enrich clubs with RA URL
 *
 * For clubs in clubs_all.json that have no ra_url (or empty),
 * searches Resident Advisor's GraphQL API by club name + city
 * and fills in the ra_url field.
 *
 * Usage: node enrich-clubs-ra.js
 * Output: writes back to data/clubs_all.json
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve }  from 'path';
import { config }            from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '.env') });

const CLUBS_PATH = resolve(__dirname, 'data/clubs_all.json');
const DELAY      = 1200;   // ms between RA requests
const RA_GQL     = 'https://ra.co/graphql';

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── RA GraphQL search ────────────────────────────────────────────────────────
// RA retired the old /api/search endpoint (now 404) and changed the GraphQL
// search field. Current working schema: search(searchTerm, indices, limit)
// returns flat results with { searchType, id, value, areaName }. The `id` is
// the venue/club id used by scrape-clubs-ra.js (ra.co/clubs/{id}).
const SEARCH_QUERY = `
query Search($searchTerm: String!) {
  search(searchTerm: $searchTerm, indices: [CLUB], limit: 8) {
    searchType
    id
    value
    areaName
  }
}`;

const RA_HEADERS = {
  'Content-Type':    'application/json',
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Referer':         'https://ra.co/',
  'Origin':          'https://ra.co',
  'Accept':          'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

const normName = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** City match — areaName vs club city (substring either way) */
function cityMatches(areaName, city) {
  const a = normName(areaName), c = normName(city);
  return !!a && !!c && (a.includes(c) || c.includes(a));
}

// Generic words that don't identify a specific venue (location words handled
// separately). A match on these alone is not confident enough.
const GENERIC = new Set([
  'club', 'house', 'arena', 'beach', 'garden', 'nightclub', 'disco', 'discoteque',
  'lounge', 'super', 'superclub', 'open', 'play', 'world', 'midnight', 'space',
]);

/**
 * Distinctive identity words from the venue name: length ≥4, not the city, and
 * not a generic venue word. Matching on "Saigon" (the city) or "Club" (generic)
 * cross-links unrelated venues, so those are excluded.
 */
function identityWords(name, city) {
  const cityNorm = normName(city);
  return normName(name).split(/\s+/)
    .filter(w => w.length >= 4 && !cityNorm.includes(w) && !GENERIC.has(w));
}

async function searchRAClub(name, city) {
  try {
    const res = await fetch(RA_GQL, {
      method:  'POST',
      headers: RA_HEADERS,
      body:    JSON.stringify({ query: SEARCH_QUERY, variables: { searchTerm: name } }),
      signal:  AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const json    = await res.json();
    const results = (json?.data?.search || []).filter(r => r && r.id && r.value);
    if (!results.length) return null;

    // Precision over recall: a wrong ra_url pulls events from the wrong venue/city
    // into the DB, which is worse than no events. Always require the city to match.

    // 1) exact name + same city
    const exactCity = results.find(r => normName(r.value) === normName(name) && cityMatches(r.areaName, city));
    if (exactCity) return `https://ra.co/clubs/${exactCity.id}`;

    // 2) leading distinctive word (the venue's head name) + same city.
    // Require words[0] specifically — matching on a trailing location synonym
    // (e.g. "Saigon" for a club in "Ho Chi Minh City") cross-links venues.
    const words = identityWords(name, city);
    if (words.length) {
      const head   = words[0];
      const byWord = results.find(r => normName(r.value).includes(head) && cityMatches(r.areaName, city));
      if (byWord) return `https://ra.co/clubs/${byWord.id}`;
    }

    // No confident match → treat as not on RA (never blind-accept results[0])
    return null;
  } catch {
    return null;
  }
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  const clubs = JSON.parse(readFileSync(CLUBS_PATH, 'utf8'));
  const missing = clubs.filter(c => !c.ra_url || c.ra_url.trim() === '');

  console.log('╔══════════════════════════════════════════╗');
  console.log('║  SoundMyth – Enrich Clubs with RA URL    ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`\n📋  Total clubs  : ${clubs.length}`);
  console.log(`🔍  Missing RA   : ${missing.length}\n`);
  console.log('─'.repeat(58));

  let found = 0, notFound = 0;

  for (let i = 0; i < missing.length; i++) {
    const club = missing[i];
    const pct  = Math.round(((i + 1) / missing.length) * 100);
    process.stdout.write(`[${String(i+1).padStart(2)}/${missing.length}] ${pct.toString().padStart(3)}% │ ${club.name.padEnd(30)} `);

    const raUrl = await searchRAClub(club.name, club.city);

    if (raUrl) {
      // Update in original array
      const idx = clubs.findIndex(c => c.name === club.name && c.city === club.city);
      if (idx !== -1) clubs[idx].ra_url = raUrl;
      console.log(`✓  ${raUrl}`);
      found++;
    } else {
      console.log(`–  not found on RA`);
      notFound++;
    }

    await sleep(DELAY);
  }

  // Save back
  writeFileSync(CLUBS_PATH, JSON.stringify(clubs, null, 2), 'utf8');

  console.log('\n╔══════════════════════════════════════════╗');
  console.log(`║  Enrichment complete                     ║`);
  console.log(`║  Found    : ${String(found).padEnd(29)} ║`);
  console.log(`║  Not found: ${String(notFound).padEnd(29)} ║`);
  console.log(`║  Saved to : clubs_all.json               ║`);
  console.log('╚══════════════════════════════════════════╝');

  if (notFound > 0) {
    console.log('\nClubs NOT found on RA (likely not listed there):');
    missing.filter((c,i) => {
      const idx = clubs.findIndex(x => x.name === c.name && x.city === c.city);
      return idx !== -1 && (!clubs[idx].ra_url || clubs[idx].ra_url === '');
    }).forEach(c => console.log(`  - ${c.name}  (${c.city}, ${c.country})`));
  }
}

main().then(() => process.exit(0)).catch(err => { console.error('Fatal:', err); process.exit(1); });
