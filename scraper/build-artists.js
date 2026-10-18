/**
 * SoundMyth – build the DJ artifact the frontend reads (web/data/artists.json).
 *
 * Offline and fast: no image lookups happen here. It only combines data that is already
 * on disk (enrich-images.js fills the photo cache; this step publishes it).
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
 * Usage: node build-artists.js
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { djKey, loadDJCache, loadOverrides } from './enrich-images.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const readJ = (p, fallback) => {
  const abs = resolve(__dirname, p);
  if (!existsSync(abs)) return fallback;
  try { return JSON.parse(readFileSync(abs, 'utf8')); } catch { return fallback; }
};
const OUT = resolve(__dirname, '../data/artists.json');

// ── Canonical genre (CONTRACT §1) ─────────────────────────────────────────
// LOCAL FALLBACK: integrate with scraper/genres.js when B1 lands it (it should own this map).
export const CANONICAL_GENRES = ['House', 'Tech House', 'Deep House', 'Afro House', 'Melodic Techno', 'Techno', 'Hard Techno',
  'Trance', 'Psytrance', 'Progressive', 'Big Room', 'Bass', 'Drum & Bass', 'Hardstyle', 'Indie Dance', 'Electro'];
export const FALLBACK_GENRE = 'Multi-genre';
const LEGACY = {
  'Big Room / Festival EDM': 'Big Room', 'Bass Music': 'Bass', 'Indie Dance / Leftfield': 'Indie Dance',
  'Drum & Bass / Breaks': 'Drum & Bass', 'Progressive House': 'Progressive', 'Hard Dance': 'Hardstyle',
  'Hardcore': 'Hardstyle', 'Acid House': 'House', 'Melodic House': 'Melodic Techno',
  'Melodic House & Techno': 'Melodic Techno', 'Electronic': FALLBACK_GENRE, 'Pop': FALLBACK_GENRE,
  'Pop Electronic / Crossover': FALLBACK_GENRE,
};
// Used only when the genre field is unusable (UNKNOWN, Electronic, Pop…): subgenre hints.
const SUBGENRE_HINT = [
  [/^tech house$/i, 'Tech House'], [/^(deep house|organic house)$/i, 'Deep House'], [/^afro house$/i, 'Afro House'],
  [/melodic techno|melodic house/i, 'Melodic Techno'], [/hard techno|industrial techno/i, 'Hard Techno'],
  [/techno|minimal/i, 'Techno'], [/big room/i, 'Big Room'], [/progressive trance|uplifting trance|tech trance|trance/i, 'Trance'],
  [/psy/i, 'Psytrance'], [/progressive/i, 'Progressive'], [/drum|dnb|jungle|liquid|breakbeat/i, 'Drum & Bass'],
  [/hardstyle|rawstyle|hardcore/i, 'Hardstyle'], [/dubstep|trap|bass|future bass|brazilian/i, 'Bass'],
  [/electro/i, 'Electro'], [/indie dance|leftfield/i, 'Indie Dance'], [/house|garage|tropical|slap|future house|piano/i, 'House'],
];

export function canonicalGenre(genre, subgenre) {
  const g = (genre || '').trim();
  if (CANONICAL_GENRES.includes(g)) return g;
  if (LEGACY[g]) return LEGACY[g];
  for (const [re, out] of SUBGENRE_HINT) if (out && re.test(subgenre || '')) return out;
  return FALLBACK_GENRE;   // unknown genre: DJ-level "not classified yet" (flagged in the report)
}

// ── Vibes (CONTRACT §3 whitelist; never both underground and mainstream) ─────
const VIBE_WHITELIST = new Set(['melodic', 'dark', 'hard', 'underground', 'mainstream', 'vocal', 'atmospheric',
  'experimental', 'classic', 'disco', 'emotional', 'psychedelic', 'latin', 'afro']);
export function vibesFromTags(tags) {
  const list = (Array.isArray(tags) ? tags : String(tags || '').split(','))
    .map(t => String(t).trim().toLowerCase()).filter(t => VIBE_WHITELIST.has(t));
  const uniq = [...new Set(list)];
  if (uniq.includes('underground') && uniq.includes('mainstream')) {
    uniq.splice(0, uniq.length, ...uniq.filter(t => t !== 'underground' && t !== 'mainstream'));
  }
  return uniq.slice(0, 3);
}

// ── Photo (verified only; "" otherwise) ─────────────────────────────────────
const isHttp = u => typeof u === 'string' && /^https?:\/\//.test(u);

// ── Main ─────────────────────────────────────────────────────────────────────
async function upcomingDJNames() {
  const today = new Date().toISOString().split('T')[0];
  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  let rows = [];
  if (SB_URL && SB_KEY) {
    const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
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
  const all = readJ('data/artists_all.json', []);
  const top100 = new Set(readJ('data/artists_top100.json', []).map(a => djKey(a.name)));
  const candidates = readJ('data/artists_candidates.json', []).filter(c => c.onRA === true);
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
