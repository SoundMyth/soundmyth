/**
 * SoundMyth – Image enricher v3 (verified DJ identity)
 *
 * DJ photos — resolved per DJ (djKey), in this order, stopping at the first VERIFIED hit:
 *   0. manual override  data/dj_images_overrides.json  ({djKey: url | ""}; "" = force initials)
 *   1. Resident Advisor  GraphQL artist(slug) — exact name match, RA is EDM-only
 *   2. Deezer            /search/artist — exact name match, highest nb_fan, placeholder rejected
 *   3. Songkick          artist profile photo of the ID in songkick_url (name checked on the page)
 *   4. TheAudioDB        search.php — exact name match + electronic genre only
 *   5. Wikipedia         REST summary of the exact title, music article only
 * Nothing verified → img "" (frontend shows initials; never a random photo).
 *
 * Results go to data/dj_images_cache.json (keyed by djKey, CACHE_VERSION 6). Transient
 * errors are NOT cached, so the next run retries them. Resumable: the cache is saved
 * every few lookups and the run stops cleanly when its time budget is spent.
 *
 * Event images:
 *   - festival events → og:image of the festival website / FESTIVAL_IMAGE_OVERRIDES (unchanged)
 *   - other future events → headliner's verified photo (first of the first 3 acts), else ""
 *
 * Env: SUPABASE_URL + SUPABASE_SERVICE_KEY (pipeline; without them only the caches are
 *      updated), EVENTS_JSON (optional path to an events snapshot used as the DJ list
 *      when no DB access is available), DJ_TIME_BUDGET_MIN (default 25).
 *
 * Usage: node enrich-images.js
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { config } from 'dotenv';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, resolve } from 'path';
import { withRetry, SK_HEADERS } from './http.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '.env') });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// ── Identity helpers ───────────────────────────────────────────────────────
// Storage key — identical to the frontend (CONTRACT §4). Do not change.
export const djKey = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '');

// Comparison used to accept a candidate from a source. Stricter than djKey: punctuation
// counts ("F!sher" ≠ "Fisher"), but a punctuated name from our data may match an
// unpunctuated source name ("Rossi." ≈ "Rossi", "Blond:ish" ≈ "Blondish").
const fold = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/&/g, ' and ').replace(/\s+/g, ' ').trim();
const loose = s => s.replace(/[^a-z0-9]/g, '');
export function sameName(ours, theirs) {
  const a = fold(ours), b = fold(theirs);
  if (!a || !b) return false;
  if (a === b) return true;
  return /[^a-z0-9 ]/.test(a) && loose(a) === loose(b);
}

// ── Throttling (per host; polite, not parallel) ────────────────────────────
const lastCall = {};
async function gate(host, minGapMs) {
  const wait = (lastCall[host] || 0) + minGapMs - Date.now();
  if (wait > 0) await sleep(wait);
  lastCall[host] = Date.now();
}

// 404 means "no such entity" → null (a real miss, cacheable). Anything else that fails throws,
// which resolveDJ treats as transient (not cached, retried next run).
async function getJSON(url, host, gapMs, headers = {}, timeoutMs = 10000) {
  await gate(host, gapMs);
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json', ...headers }, signal: AbortSignal.timeout(timeoutMs) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Source 1: Resident Advisor ─────────────────────────────────────────────
const RA_GQL = 'https://ra.co/graphql';
const RA_HEADERS = { 'Content-Type': 'application/json', 'User-Agent': UA, Referer: 'https://ra.co/', Origin: 'https://ra.co', 'ra-content-language': 'en' };
const RA_ARTIST_Q = 'query G($s:String!){ artist(slug:$s){ id name aliases image } }';

export const raSlugFromUrl = url => ((url || '').match(/ra\.co\/dj\/([^/?#\s]+)/i) || [])[1] || null;
const slugGuess = name => fold(name).normalize('NFD').replace(/[^a-z0-9]+/g, '');

// Returns { img, artistName } on an exact match with a photo; { img:null } when RA has
// the artist but no photo; null when RA has no exact artist; throws on transport errors.
export async function sourceRA(name, raUrl) {
  const slug = raSlugFromUrl(raUrl) || slugGuess(name);
  if (!slug) return null;
  await gate('ra', 450);
  const res = await fetch(RA_GQL, { method: 'POST', headers: RA_HEADERS,
    body: JSON.stringify({ query: RA_ARTIST_Q, variables: { s: slug } }), signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`RA HTTP ${res.status}`);
  const j = await res.json();
  if (!j || (j.errors && !j.data)) throw new Error('RA error');
  const a = j.data?.artist;
  if (!a) return null;
  const names = [a.name, ...(a.aliases || [])];
  if (!names.some(n => sameName(name, n))) return null;   // e.g. "fisher" → "Mike Fisher"
  return { img: a.image || null, artistName: a.name };
}

// ── Source 2: Deezer (public, no key) ──────────────────────────────────────
const DEEZER_PLACEHOLDER = 'd41d8cd98f00b204e9800998ecf8427e';   // md5('') — Deezer's "no picture" hash

export async function sourceDeezer(name) {
  const j = await getJSON(`https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=25`, 'deezer', 150);
  const exact = (j?.data || []).filter(a => sameName(name, a.name));
  if (!exact.length) return null;
  exact.sort((x, y) => (y.nb_fan || 0) - (x.nb_fan || 0));
  const best = exact[0];
  const pic = best.picture_xl || best.picture_big || '';
  const placeholder = !pic || pic.includes(DEEZER_PLACEHOLDER);
  return { img: placeholder ? null : pic, artistName: best.name, fans: best.nb_fan || 0, candidates: exact.length };
}

// ── Source 3: Songkick (artist id from songkick_url; page checked) ──────────
export const skIdFromUrl = url => ((url || '').match(/songkick\.com\/artists\/(\d+)/i) || [])[1] || null;

export async function sourceSongkick(skUrl, name) {
  const id = skIdFromUrl(skUrl);
  if (!id) return null;
  await gate('songkick', 1000);
  const res = await fetch(`https://www.songkick.com/artists/${id}`, { headers: SK_HEADERS, redirect: 'follow', signal: AbortSignal.timeout(12000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`SK HTTP ${res.status}`);
  const html = await res.text();
  // The artist's own JSON-LD MusicGroup (sameAs points at this id) gives the canonical name.
  const artistName = (html.match(new RegExp(`"@type":"MusicGroup","name":"([^"]+)"[^}]*?songkick\\.com\\\\?/artists\\\\?/${id}-`)) || [])[1]
    || (html.match(/<title>([^<]+?) Tickets/) || [])[1] || '';
  const photo = html.includes(`images.sk-static.com/images/media/profile_images/artists/${id}/huge_avatar`)
    ? `https://images.sk-static.com/images/media/profile_images/artists/${id}/huge_avatar`
    : (html.includes(`profile_images/artists/${id}/large_avatar`) ? `https://images.sk-static.com/images/media/profile_images/artists/${id}/large_avatar` : null);
  const canon = artistName.replace(/&amp;/g, '&');
  if (!canon || (name && !sameName(name, canon))) return { img: null, artistName: canon, reason: 'name' };
  return { img: photo, artistName: canon };
}

// ── Source 4: TheAudioDB (exact name, electronic genre only) ──────────────
const ELECTRONIC_GENRE = /electro|dance|house|techno|trance|dubstep|drum|bass|hard|edm|garage|breaks|trap|disco|big beat|psy|hardcore|jungle|ambient/i;

// The free key "2" answers 404 "Not found" for every query as of 2026-10 (the frontend
// used it too); "123" is TheAudioDB's public key and still answers. Override with THEAUDIODB_KEY.
const AUDIODB_KEY = process.env.THEAUDIODB_KEY || '123';
export async function sourceAudioDB(name) {
  const j = await getJSON(`https://www.theaudiodb.com/api/v1/json/${AUDIODB_KEY}/search.php?s=${encodeURIComponent(name)}`, 'audiodb', 2100);
  const a = (j?.artists || []).find(x => sameName(name, x.strArtist));
  if (!a) return null;
  const img = a.strArtistThumb || '';
  if (!img) return { img: null, artistName: a.strArtist };
  if (!ELECTRONIC_GENRE.test(a.strGenre || '') && !ELECTRONIC_GENRE.test(a.strStyle || '')) return { img: null, artistName: a.strArtist, reason: 'genre' };
  return { img, artistName: a.strArtist, genre: a.strGenre };
}

// ── Source 5: Wikipedia (exact title, music article only) ─────────────────
export async function sourceWikipedia(name) {
  const title = name.trim().replace(/ /g, '_');
  const j = await getJSON(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, 'wikipedia', 200,
    { 'User-Agent': 'SoundMyth/1.0 (DJ event aggregator; contact@soundmyth.com)', Accept: 'application/json' });
  if (!j || j.type !== 'standard' || !j.title) return null;
  if (!sameName(name, j.title)) return null;
  const desc = `${j.description || ''} ${j.extract || ''}`;
  if (!/\b(DJ|disc jockey|music producer|record producer|musician|electronic|techno|house music|trance)\b/i.test(desc)) return null;
  const img = j.thumbnail?.source || null;
  return { img, artistName: j.title, desc: (j.description || '').slice(0, 80) };
}

// ── Caches ─────────────────────────────────────────────────────────────────
const DJ_CACHE_PATH = resolve(__dirname, 'data/dj_images_cache.json');
const DJ_OVERRIDES_PATH = resolve(__dirname, 'data/dj_images_overrides.json');
const FEST_CACHE_PATH = resolve(__dirname, 'data/festival_images_cache.json');

// DJ cache format changed in v6: entries are keyed by djKey and carry {name, img, source,
// checked}. The v5 cache (name-keyed TheAudioDB/Wikipedia URLs, unverified) is discarded.
export const DJ_CACHE_VERSION = 6;
const FEST_CACHE_VERSION = 5;   // festival cache semantics unchanged

function readJSON(path, fallback) {
  if (!existsSync(path)) return fallback;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; }
}

export function loadDJCache() {
  const raw = readJSON(DJ_CACHE_PATH, {});
  if (raw._cache_version !== DJ_CACHE_VERSION) return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) if (k !== '_cache_version' && v && typeof v === 'object') out[k] = v;
  return out;
}

export function saveDJCache(cache) {
  const out = { _cache_version: DJ_CACHE_VERSION };
  for (const k of Object.keys(cache).sort()) out[k] = cache[k];
  writeFileSync(DJ_CACHE_PATH, JSON.stringify(out, null, 1) + '\n');
}

export function loadOverrides() {
  const raw = readJSON(DJ_OVERRIDES_PATH, {});
  const out = {};
  for (const [k, v] of Object.entries(raw)) if (!k.startsWith('_') && typeof v === 'string') out[djKey(k)] = v;
  return out;
}

// ── DJ resolution ──────────────────────────────────────────────────────────
// Returns { img, source, artistName?, checked } and never a guess. `retry: true` when a
// transient error means "don't cache this one yet".
export async function resolveDJ(name, { raUrl = '', skUrl = '', skEventImg = '', overrides = {} } = {}) {
  const key = djKey(name);
  const checked = new Date().toISOString().slice(0, 10);
  if (key in overrides) return { img: overrides[key] || null, source: overrides[key] ? 'override' : 'override-none', checked };

  let retry = false;
  const attempt = async (source, fn) => {
    try {
      const r = await fn();
      if (r && r.img) return { img: r.img, source, artistName: r.artistName, checked };
    } catch { retry = true; }
    return null;
  };

  // Order = identity confidence: RA is EDM-only with an exact artist record; Songkick is a
  // curated artist id whose page name is checked; songkick-event is the Songkick artist photo
  // the scraper stored on a single-act event (same artist id); Wikipedia needs an exact title
  // on a music article; Deezer is an exact name match among many namesakes (most-fans
  // heuristic); TheAudioDB is the weakest (free key, sparse electronic metadata) and goes last.
  const hit =
       await attempt('ra', () => sourceRA(name, raUrl))
    || (skUrl ? await attempt('songkick', () => sourceSongkick(skUrl, name)) : null)
    || (skEventImg ? await attempt('songkick-event', async () => ({ img: skEventImg, artistName: name })) : null)
    || await attempt('wikipedia', () => sourceWikipedia(name))
    || await attempt('deezer', () => sourceDeezer(name))
    || await attempt('audiodb', () => sourceAudioDB(name));
  if (hit) return hit;
  return { img: null, source: retry ? 'error' : 'none', checked };
}

const SK_ARTIST_PHOTO = /^https?:\/\/images\.sk-static\.com\/images\/media\/profile_images\/artists\/\d+\//;
const KEEP_EVENT_IMG = /^https?:\/\/(images\.sk-static\.com|photos\.bandsintown\.com|cdn\.ticket\.io|static\.ra\.co)\//;

// ── Festival og:image lookup (unchanged behaviour) ─────────────────────────
const festCacheRaw = readJSON(FEST_CACHE_PATH, {});
let festCache = {};
if (festCacheRaw._cache_version === FEST_CACHE_VERSION) festCache = festCacheRaw;
else {
  // Clear failed (null) festival lookups so they retry with the current search logic
  for (const [k, v] of Object.entries(festCacheRaw)) if (k !== '_cache_version' && v !== null) festCache[k] = v;
}

function saveFestCache() {
  const out = { _cache_version: FEST_CACHE_VERSION };
  for (const [k, v] of Object.entries(festCache)) { if (k !== '_cache_version') out[k] = v; }
  writeFileSync(FEST_CACHE_PATH, JSON.stringify(out, null, 2));
}

const FESTIVAL_IMAGE_OVERRIDES = {
  'tomorrowland': 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&h=400&fit=crop',
  'edc': 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=800&h=400&fit=crop',
  'electric daisy carnival': 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=800&h=400&fit=crop',
  'a state of trance': 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&h=400&fit=crop',
  'ultra music festival': 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&h=400&fit=crop',
  'ultra miami': 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&h=400&fit=crop',
  'sonus': 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=400&fit=crop',
  'elements festival': 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&h=400&fit=crop',
  'dreamstate': 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&h=400&fit=crop',
  'airbeat one': 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&h=400&fit=crop',
  'dreambeach': 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=400&fit=crop',
  'untold': 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&h=400&fit=crop',
  'medusa': 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=400&fit=crop',
  'groove cruise': 'https://images.unsplash.com/photo-1507608616759-54f48f0af0ee?w=800&h=400&fit=crop',
  'the crave': 'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=800&h=400&fit=crop',
  'austria goes zrce': 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=400&fit=crop',
  'wknd': 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&h=400&fit=crop',
};

async function fetchFestivalImage(url) {
  const key = url.toLowerCase().replace(/\/+$/, '');
  if (key in festCache) return festCache[key];
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html' },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    });
    if (!res.ok) { festCache[key] = null; return null; }
    const html = await res.text();
    const ogImg = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1]
               || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1]
               || html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)?.[1]
               || null;
    // Detect tracking pixels by filename, never by substring ("1x1" is a legitimate aspect marker)
    const basename = (ogImg || '').split(/[?#]/)[0].split('/').pop();
    const isPixel  = /^(1x1|pixel|spacer|blank|transparent)\.(gif|png|jpe?g|webp)$/i.test(basename);
    const img = ogImg && ogImg.startsWith('http') && !isPixel ? ogImg : null;
    festCache[key] = img;
    return img;
  } catch {
    festCache[key] = null;
    return null;
  }
}

const festImageForName = name => {
  const lower = name.toLowerCase();
  for (const [kw, img] of Object.entries(FESTIVAL_IMAGE_OVERRIDES)) if (lower.includes(kw)) return img;
  return null;
};

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  SoundMyth – Image Enricher v3               ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
  const sb = SB_URL && SB_KEY ? createClient(SB_URL, SB_KEY, { auth: { persistSession: false } }) : null;
  if (!sb) console.log('No Supabase service key: caches only, event rows will not be updated.\n');

  const readData = p => readJSON(resolve(__dirname, p), []);
  const festivals = readData('data/festivals_all.json');
  const artists = readData('data/artists_all.json');

  // Future events (paged). Snapshot file used as a fallback when there is no DB access.
  const today = new Date().toISOString().split('T')[0];
  let allEvents = [];
  if (sb) {
    let from = 0;
    while (true) {
      const { data, error } = await withRetry(
        () => sb.from('events').select('id, name, djs, tags, img_url').gte('date', today)
          .range(from, from + 999).order('date', { ascending: true }),
        `Load events page (from=${from})`, 5, 5000);
      if (error) { console.error('Fetch error:', error.message || error); process.exit(1); }
      allEvents = allEvents.concat(data);
      if (data.length < 1000) break;
      from += 1000;
    }
  } else if (process.env.EVENTS_JSON && existsSync(process.env.EVENTS_JSON)) {
    allEvents = readJSON(process.env.EVENTS_JSON, []).filter(e => (e.date || '') >= today);
  }
  console.log(`Future events: ${allEvents.length}\n`);

  // ── PASS 1: festival images ───────────────────────────────────────────────
  const isFest = e => (e.tags || []).includes('festival');
  const festEvents = allEvents.filter(isFest);
  const festWebsite = {};
  for (const f of festivals) {
    if (f.website && !f.website.includes('facebook') && !f.website.includes('twitter')) festWebsite[f.name.toLowerCase().trim()] = f.website;
  }
  console.log(`── Pass 1: Festival images (${festEvents.length} events) ──`);
  const festMatches = [];
  for (const ev of festEvents) {
    const nameKey = (ev.name || '').toLowerCase().trim();
    let url = festWebsite[nameKey];
    if (!url) for (const [fName, fUrl] of Object.entries(festWebsite)) {
      if (nameKey.includes(fName) || fName.includes(nameKey)) { url = fUrl; break; }
    }
    if (url) festMatches.push({ ev, url });
  }
  const uniqueUrls = [...new Set(festMatches.map(m => m.url))];
  const toFetchFest = uniqueUrls.filter(u => !(u.toLowerCase().replace(/\/+$/, '') in festCache));
  console.log(`  Matched to websites: ${festMatches.length}; new og:image lookups: ${toFetchFest.length}`);
  for (let i = 0; i < toFetchFest.length; i++) {
    await fetchFestivalImage(toFetchFest[i]);
    if ((i + 1) % 20 === 0) saveFestCache();
    await sleep(400);
  }
  saveFestCache();

  const festImgFor = ev => {
    for (const { ev: e, url } of festMatches) if (e.id === ev.id) {
      const img = festCache[url.toLowerCase().replace(/\/+$/, '')];
      if (img) return img;
    }
    return festImageForName(ev.name || '');
  };
  let festUpdated = 0;
  if (sb) for (const ev of festEvents) {
    const img = festImgFor(ev);
    if (!img || img === ev.img_url) continue;
    const { error } = await sb.from('events').update({ img_url: img }).eq('id', ev.id);
    if (!error) festUpdated++;
  }
  console.log(`  Festival events ${sb ? 'updated' : 'resolved (no DB)'}: ${festUpdated || festEvents.filter(e => festImgFor(e)).length}\n`);

  // ── PASS 2: DJ photos (verified identity) ──────────────────────────────────
  // Priority: DJs on upcoming (non-festival) events first, then the curated list by ranking.
  const skById = new Map();
  for (const a of artists) skById.set(djKey(a.name), a);
  const djEvents = allEvents.filter(e => !isFest(e) && (e.djs || []).length);
  // Single-act events whose photo is a Songkick artist profile: that photo is the act's own.
  const skEventImg = new Map();
  for (const e of djEvents) {
    if (e.djs.length === 1 && SK_ARTIST_PHOTO.test(e.img_url || '')) skEventImg.set(djKey(e.djs[0]), e.img_url);
  }
  const upcomingDJs = [...new Set(djEvents.flatMap(e => e.djs.slice(0, 3)))];
  const listDJs = [...artists].sort((a, b) => (a.ranking || 1e9) - (b.ranking || 1e9)).map(a => a.name);
  const queue = [];
  const seen = new Set();
  for (const name of [...upcomingDJs, ...listDJs]) {
    const k = djKey(name);
    if (!k || seen.has(k)) continue;
    seen.add(k); queue.push(name);
  }

  const cache = loadDJCache();
  const overrides = loadOverrides();
  const budgetMs = Number(process.env.DJ_TIME_BUDGET_MIN || 25) * 60000;
  const t0 = Date.now();
  let looked = 0, hits = 0, errors = 0, skipped = 0;
  const bySource = {};
  console.log(`── Pass 2: DJ photos (${queue.length} distinct names, ${Object.keys(cache).length} cached) ──`);
  for (const name of queue) {
    const k = djKey(name);
    if (k in cache && !(k in overrides)) { skipped++; continue; }
    if (Date.now() - t0 > budgetMs) { console.log(`  Time budget reached; resume on next run.`); break; }
    const meta = skById.get(k) || {};
    const r = await resolveDJ(name, { raUrl: meta.ra_url || '', skUrl: meta.songkick_url || '', skEventImg: skEventImg.get(k) || '', overrides });
    looked++;
    if (r.source === 'error') { errors++; continue; }     // transient: not cached, retried next run
    cache[k] = { name, img: r.img, source: r.source, checked: r.checked, ...(r.artistName && r.artistName !== name ? { matched: r.artistName } : {}) };
    if (r.img) hits++;
    bySource[r.source] = (bySource[r.source] || 0) + 1;
    if (looked % 25 === 0) { saveDJCache(cache); console.log(`  ${looked} looked up · ${hits} photos · ${errors} transient`); }
  }
  // Overrides always win in the cache, even for names already cached
  for (const [k, v] of Object.entries(overrides)) {
    cache[k] = { name: cache[k]?.name || k, img: v || null, source: v ? 'override' : 'override-none', checked: new Date().toISOString().slice(0, 10) };
  }
  saveDJCache(cache);
  console.log(`  Looked up: ${looked} · photos: ${hits} · transient errors: ${errors} · from cache: ${skipped}`);
  console.log(`  By source: ${JSON.stringify(bySource)}\n`);

  // Event rows: DJ shows get the headliner's verified photo; "" when none.
  const verifiedFor = names => {
    for (const n of names.slice(0, 3)) {
      const c = cache[djKey(n)];
      if (c && c.img) return c.img;
    }
    return '';
  };
  // Scraper-provided event photos from a known source (Songkick artist/event photos,
  // Bandsintown, ticket.io, RA) are kept. Empty or legacy name-search images (TheAudioDB,
  // Wikipedia from v5) are replaced by the headliner's verified photo, or cleared.
  let djUpdated = 0, djCleared = 0;
  if (sb) for (const ev of djEvents) {
    const have = ev.img_url || '';
    if (KEEP_EVENT_IMG.test(have)) continue;
    const want = verifiedFor(ev.djs);
    if (want === have) continue;
    const { error } = await sb.from('events').update({ img_url: want }).eq('id', ev.id);
    if (!error) { if (want) djUpdated++; else djCleared++; }
  }
  console.log(`  DJ events: ${djUpdated} given a verified photo, ${djCleared} cleared (no verified photo)`);
  console.log('Done.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(() => process.exit(0)).catch(err => { console.error('Fatal:', err); process.exit(1); });
}
