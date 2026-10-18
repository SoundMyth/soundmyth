/**
 * SoundMyth – build the DJ artifact the frontend reads (web/data/artists.json).
 *
 * Offline and fast: no image lookups happen here. It only combines data that is already
 * on disk (steps/14-enrich-images.js fills the photo cache; this step publishes it).
 *
 *   artists_all.json        → name, canonical genre, vibes (from tags), ranking
 *   artists_top100.json     → top100 flag
 *   artists_candidates.json → RA-verified EDM DJs not in the curated list (onRA:true)
 *   dj_images_cache.json    → verified photo per djKey (img "" when none)
 *   dj_images_overrides.json→ manual photo decisions (win over the cache)
 *   upcoming events         → every other DJ on a future event gets an entry too
 *                             (Supabase when credentials are set, else EVENTS_JSON, else skipped)
 *
 * Output schema (CONTRACT §4):
 *   { "generated": ISO, "artists": { "<djKey>": { name, genre, img, top100, vibes } } }
 *
 * Usage: node steps/15-build-artists.js
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, resolve } from 'path';
import { loadDJCache, loadOverrides } from './14-enrich-images.js';
import { djKey, djStyle, normVibes, FALLBACK_GENRE } from '../lib/genres.js';
import { makeClient } from '../lib/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const readJ = (p, fallback) => {
  const abs = resolve(__dirname, p);
  if (!existsSync(abs)) return fallback;
  try { return JSON.parse(readFileSync(abs, 'utf8')); } catch { return fallback; }
};
const OUT = resolve(__dirname, '../../data/artists.json');

// ── Genre + vibes: the shared taxonomy in lib/genres.js (contract §1/§3) ──────────
// A DJ with no usable genre gets FALLBACK_GENRE ("Multi-genre" = not classified yet);
// the frontend ignores those DJs when computing an event's genre.
export const canonicalGenre = (genre, subgenre) => djStyle(genre, subgenre) || FALLBACK_GENRE;
export const vibesFromTags = tags => normVibes(tags).slice(0, 3);

// ── Photo (verified only; "" otherwise) ─────────────────────────────────────
const isHttp = u => typeof u === 'string' && /^https?:\/\//.test(u);

// ── Main ─────────────────────────────────────────────────────────────────────
async function upcomingDJNames() {
  const today = new Date().toISOString().split('T')[0];
  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  let rows = [];
  if (SB_URL && SB_KEY) {
    const sb = makeClient(SB_URL, SB_KEY);
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from('events').select('djs,date').gte('date', today).range(from, from + 999);
      if (error) { console.warn(`  ⚠ events read failed (${error.message || error}); using lists only`); rows = []; break; }
      rows = rows.concat(data);
      if (data.length < 1000) break;
    }
    console.log(`  Upcoming events from Supabase: ${rows.length}`);
  } else if (process.env.EVENTS_JSON && existsSync(process.env.EVENTS_JSON)) {
    rows = JSON.parse(readFileSync(process.env.EVENTS_JSON, 'utf8')).filter(e => (e.date || '') >= today);
    console.log(`  Upcoming events from EVENTS_JSON: ${rows.length}`);
  } else {
    console.log('  No event source (set SUPABASE_URL + key, or EVENTS_JSON): artists from lists only');
  }
  const names = new Map();   // djKey → first spelling seen
  for (const e of rows) for (const d of (e.djs || [])) {
    const k = djKey(d);
    if (k && !names.has(k)) names.set(k, d);
  }
  return names;
}

async function main() {
  const all = readJ('../data/artists_all.json', []);
  const top100 = new Set(readJ('../data/artists_top100.json', []).map(a => djKey(a.name)));
  const candidates = readJ('../data/artists_candidates.json', []).filter(c => c.onRA === true);
  const cache = loadDJCache();
  const overrides = loadOverrides();

  const artists = {};
  const put = (name, meta) => {
    const k = djKey(name);
    if (!k || artists[k]) return;
    const img = k in overrides ? (overrides[k] || '')
      : (cache[k] && isHttp(cache[k].img) ? cache[k].img : '');
    artists[k] = {
      name: meta.name || name,
      genre: canonicalGenre(meta.genre, meta.subgenre),
      img,
      top100: top100.has(k),
      ...(meta.ranking ? { rank: meta.ranking } : {}),
      vibes: vibesFromTags(meta.tags),
    };
  };

  // 1. Curated list (ranking order so the first spelling wins deterministically)
  for (const a of [...all].sort((x, y) => (x.ranking || 1e9) - (y.ranking || 1e9))) put(a.name, a);
  // 2. RA-verified candidates (EDM-only source; no genre known → fallback)
  for (const c of candidates) put(c.name, {});
  // 3. Every other DJ on an upcoming event
  const upcoming = await upcomingDJNames();
  for (const [k, name] of upcoming) if (!artists[k]) put(name, {});

  // Coverage report — the number that matters is verified photos among upcoming DJs
  const upcomingKeys = [...upcoming.keys()];
  const withImgUp = upcomingKeys.filter(k => artists[k]?.img).length;
  const withImgAll = Object.values(artists).filter(a => a.img).length;
  const genreCount = {};
  for (const a of Object.values(artists)) genreCount[a.genre] = (genreCount[a.genre] || 0) + 1;

  const sorted = {};
  for (const k of Object.keys(artists).sort()) sorted[k] = artists[k];
  const out = { generated: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), artists: sorted };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');

  console.log(`\nartists.json: ${Object.keys(sorted).length} DJs · ${withImgAll} with verified photo`);
  if (upcomingKeys.length) console.log(`  Upcoming-event DJs: ${upcomingKeys.length} · with photo: ${withImgUp} (${Math.round(100 * withImgUp / upcomingKeys.length)}%)`);
  console.log(`  Genres: ${JSON.stringify(genreCount)}`);
  console.log(`  Wrote ${OUT}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => { console.error('Fatal:', err); process.exit(1); });
}
