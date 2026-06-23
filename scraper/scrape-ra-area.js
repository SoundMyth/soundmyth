/**
 * SoundMyth – Resident Advisor AREA scraper (geographic discovery)
 *
 * The other scrapers are name-driven (look up specific artists/festivals/clubs).
 * This one discovers ALL upcoming events in a set of cities via RA's GraphQL
 * `eventListings` filtered by area — filling coverage gaps (esp. Latin America)
 * with events from venues/promoters that aren't in the curated lists.
 *
 * Same row shape + source_id (`ra_<eventId>`) as scrape-clubs-ra.js, so overlapping
 * events upsert onto the same row (no duplicates).
 *
 * Usage: node scrape-ra-area.js          (writes to Supabase)
 *        DRY=1 node scrape-ra-area.js     (fetch + log only, no DB)
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { cleanEvent } from './normalize.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '.env') });

const DRY = process.env.DRY === '1';
const SB_URL = process.env.SUPABASE_URL, SB_KEY = process.env.SUPABASE_SERVICE_KEY;
const sb = (!DRY && SB_URL && SB_KEY) ? createClient(SB_URL, SB_KEY, { auth: { persistSession: false } }) : null;
if (!DRY && !sb) { console.error('❌ Missing Supabase env (use DRY=1 to test without writing)'); process.exit(1); }

const TODAY = new Date().toISOString().split('T')[0];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const RA = 'https://ra.co/graphql';
const H = {
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Referer': 'https://ra.co/', 'Origin': 'https://ra.co', 'ra-content-language': 'en',
};
const PAGE_SIZE = 50, MAX_PAGES = 4, DELAY = 700;
// only pull events within the next ~6 months (keeps volume + relevance sane)
const HORIZON = new Date(Date.now() + 180 * 864e5).toISOString().split('T')[0];

// Cities to discover (RA areas resolved by name at runtime; misses are skipped).
const CITIES = [
  'Madrid','Barcelona','Ibiza','London','Berlin','Amsterdam','Paris','Lisbon','Milan','Rome',
  'Munich','Cologne','Brussels','Vienna','Prague','Warsaw','Zurich','Manchester','Rotterdam',
  'New York','Los Angeles','Miami','Chicago','Montreal','Toronto',
  'Mexico City','Guadalajara','Bogota','Medellin','Buenos Aires','Sao Paulo','Rio de Janeiro',
  'Santiago','Lima','Quito','Tokyo','Bangkok','Tulum','Dubai','Tel Aviv',
];

async function gql(query, variables) {
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(RA, { method: 'POST', headers: H, body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(15000) });
      if (r.ok) return await r.json();
    } catch { /* retry */ }
    await sleep(800 * (a + 1));
  }
  return null;
}

const AREA_Q = `query A($s:String!){search(searchTerm:$s,indices:[AREA],limit:5){searchType id value}}`;
async function resolveArea(city) {
  const j = await gql(AREA_Q, { s: city });
  const hit = (j?.data?.search || []).find(x => x.searchType === 'AREA' && x.id);
  return hit ? { id: Number(hit.id), value: hit.value } : null;
}

const EVENTS_Q = `query AreaEvents($filters: FilterInputDtoInput, $pageSize: Int, $page: Int) {
  eventListings(filters: $filters, pageSize: $pageSize, page: $page, sort: { listingDate: { order: ASCENDING } }) {
    data { event {
      id title startTime date contentUrl flyerFront
      venue { name area { name country { name } } }
      artists { name }
      promotionalLinks { title url }
    } }
    totalResults
  }
}`;

function ticketUrl(links, contentUrl) {
  if (Array.isArray(links) && links.length) return (links.find(l => /ticket/i.test(l.title || '')) || links[0]).url || '';
  return contentUrl ? `https://ra.co${contentUrl}` : '';
}
function normalise(e) {
  const dateStr = (e.startTime || e.date || '').split('T')[0];
  if (!dateStr || dateStr < TODAY || !e.id) return null;
  return {
    name:       e.title || 'Event',
    venue:      e.venue?.name || '',
    city:       e.venue?.area?.name || '',
    country:    e.venue?.area?.country?.name || '',
    date:       dateStr,
    djs:        (e.artists || []).map(a => a.name).filter(Boolean),
    genre:      'Electronic',
    tags:       ['ra', 'club'],
    price:      '',
    ticket_url: ticketUrl(e.promotionalLinks, e.contentUrl),
    img_url:    e.flyerFront || '',
    source:     'ra',
    source_id:  `ra_${e.id}`,
  };
}

async function fetchArea(areaId) {
  const out = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const j = await gql(EVENTS_Q, { filters: { areas: { eq: areaId }, listingDate: { gte: TODAY + 'T00:00:00.000Z', lte: HORIZON + 'T23:59:59.999Z' } }, pageSize: PAGE_SIZE, page });
    const data = j?.data?.eventListings?.data || [];
    for (const it of data) { const n = normalise(it.event); if (n) out.push(n); }
    if (data.length < PAGE_SIZE) break;
    await sleep(DELAY);
  }
  return out;
}

async function upsert(rows) {
  if (DRY || !rows.length) return rows.length;
  const seen = new Set();
  const batch = rows.filter(e => { if (seen.has(e.source_id)) return false; seen.add(e.source_id); return true; }).map(cleanEvent);
  for (let i = 0; i < batch.length; i += 100) {
    const { error } = await sb.from('events').upsert(batch.slice(i, i + 100), { onConflict: 'source_id', ignoreDuplicates: false });
    if (error) console.error('  ❌', error.message);
  }
  return batch.length;
}

async function main() {
  console.log(`╔══ RA area scraper ${DRY ? '(DRY)' : ''} ══╗`);
  let totalFetched = 0, totalUpserted = 0, found = 0, missed = 0;
  const allSeen = new Set();
  for (const city of CITIES) {
    const area = await resolveArea(city);
    await sleep(DELAY);
    if (!area) { console.log(`  –  ${city.padEnd(16)} (no RA area)`); missed++; continue; }
    const evs = await fetchArea(area.id);
    const fresh = evs.filter(e => { if (allSeen.has(e.source_id)) return false; allSeen.add(e.source_id); return true; });
    totalFetched += fresh.length; found++;
    const n = await upsert(fresh);
    totalUpserted += n;
    console.log(`  ✓  ${city.padEnd(16)} area ${String(area.id).padStart(5)} → ${String(evs.length).padStart(4)} events`);
    await sleep(DELAY);
  }
  console.log(`\nAreas: ${found} ok, ${missed} missing · fetched ${totalFetched} · ${DRY ? 'DRY (not written)' : 'upserted ' + totalUpserted}`);
}
main().then(() => process.exit(0)).catch(e => { console.error('Fatal:', e); process.exit(1); });
