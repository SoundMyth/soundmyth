/**
 * SoundMyth – recompute genre + tags for every upcoming event.
 *
 * Pipeline step (after dedupe/cleanup-junk, before enrich-images). Rules: genres.js.
 *   genre = most frequent canonical genre among the lineup DJs (artists_all / candidates);
 *           no known DJ → the festival's curated style (festivals_all.json `style`, if any);
 *           otherwise 'Multi-genre'.
 *   tags  = [festival|club]? + at most 3 vibe tags from the DJs (whitelist only).
 *           Source names, 'discovered', 'dj', 'UNKNOWN', genre names are removed.
 *
 * Only rows whose genre or tags actually change are written (batched, parallel-limited).
 *
 * Usage:
 *   node classify.js                          # write (needs SUPABASE_URL + SUPABASE_SERVICE_KEY)
 *   node classify.js --dry-run                # diff summary, no writes
 *   node classify.js --snapshot <events.json> # read events from a JSON file instead of Supabase
 *                                             # (combine with --dry-run for offline review)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { withRetry } from './http.js';
import { STYLES, FALLBACK_GENRE, djKey, djStyle, buildArtistsIndex, eventGenre, eventTags } from './genres.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '.env') });

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const snapIdx = args.indexOf('--snapshot');
const SNAPSHOT = snapIdx >= 0 ? args[snapIdx + 1] : null;
if (snapIdx >= 0 && !SNAPSHOT) { console.error('❌  --snapshot needs a path'); process.exit(1); }

const readJ = p => { try { return JSON.parse(readFileSync(resolve(__dirname, p), 'utf8')); } catch { return []; } };
const TODAY = new Date().toISOString().split('T')[0];

// ── Load events (upcoming only) ──────────────────────────────────────────────────
let rows;
let sbClient = null;
if (SNAPSHOT) {
  rows = JSON.parse(readFileSync(resolve(SNAPSHOT), 'utf8'));
} else {
  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SB_URL || !SB_KEY) { console.error('❌  Missing SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1); }
  const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
  rows = [];
  for (let from = 0; ; from += 1000) {
    // Abort on a partial load: a truncated read would compute wrong genres for the missing rows.
    const { data, error } = await withRetry(
      () => sb.from('events').select('id,name,venue,city,date,djs,genre,tags,source')
        .gte('date', TODAY).order('id').range(from, from + 999),
      `Load events page (from=${from})`, 5, 5000);
    if (error) { console.error(`❌  Event load failed at offset ${from}: ${error.message || error}`); process.exit(1); }
    rows = rows.concat(data);
    if (data.length < 1000) break;
  }
  rows.sort((a, b) => a.id - b.id);
  sbClient = sb;
}
rows = rows.filter(e => (e.date || '') >= TODAY);
console.log(`Loaded ${rows.length} upcoming events${SNAPSHOT ? ` (snapshot ${SNAPSHOT})` : ''}.`);

// ── Reference data ───────────────────────────────────────────────────────────────
// Artists: artists_all is authoritative; candidates (RA-verified, no genre yet) fill gaps.
const artistsRows = readJ('data/artists_all.json');
const artists = buildArtistsIndex(artistsRows);
for (const c of readJ('data/artists_candidates.json')) {
  const k = djKey(c.name);
  if (k && !artists[k] && c.genre) artists[k] = buildArtistsIndex([c])[k];
}
// Festivals: `style` is added by the festivals scraper; absence is fine (→ Multi-genre).
const festStyle = new Map();
for (const f of readJ('data/festivals_all.json')) {
  const k = djKey(f.name);
  if (k && f.style && !festStyle.has(k)) festStyle.set(k, f.style);
}
const festKeys = new Set(readJ('data/festivals_all.json').map(f => djKey(f.name)).filter(Boolean));

// ── Event type (festival | club | none) ─────────────────────────────────────────
// Legacy 'festival'/'club' tags were polluted by DJ tags (a DJ's own 'festival'/'club' vibe
// leaked into every event). A 'festival' tag only counts when the line-up is not a single
// act, or the event name is a known festival. 'club' only counts on RA-sourced rows.
function eventType(e) {
  const tags = e.tags || [];
  const djs = e.djs || [];
  if (tags.includes('festival') && (djs.length !== 1 || festKeys.has(djKey(e.name)))) return 'festival';
  if (tags.includes('club') && e.source === 'ra') return 'club';
  return null;
}

// ── Compute ──────────────────────────────────────────────────────────────────────
const changes = [];
for (const e of rows) {
  const djs = Array.isArray(e.djs) ? e.djs : [];
  const type = eventType(e);
  const genre = eventGenre(djs, artists, festStyle.get(djKey(e.name)));
  const tags = eventTags(djs, artists, type);
  const oldTags = Array.isArray(e.tags) ? e.tags : [];
  const tagsChanged = tags.length !== oldTags.length || tags.some((t, i) => t !== oldTags[i]);
  if (genre !== e.genre || tagsChanged) {
    changes.push({ id: e.id, name: e.name, date: e.date, djs, oldGenre: e.genre, newGenre: genre,
      oldTags, newTags: tags, patch: { genre, tags } });
  }
}

// ── Report ───────────────────────────────────────────────────────────────────────
const count = (list, f) => list.reduce((m, x) => { const k = f(x); m[k] = (m[k] || 0) + 1; return m; }, {});
const before = count(rows, e => e.genre || '(empty)');
const after = count(rows, e => eventGenre(Array.isArray(e.djs) ? e.djs : [], artists, festStyle.get(djKey(e.name))));
const nonCanon = rows.filter(e => !STYLES.includes(e.genre) && e.genre !== FALLBACK_GENRE).length;
console.log(`Genre distribution (upcoming, before → after):`);
const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort((a, b) => (after[b] || 0) - (after[a] || 0));
for (const k of keys) console.log(`  ${String(k).padEnd(26)} ${String(before[k] || 0).padStart(5)} → ${String(after[k] || 0).padStart(5)}`);
console.log(`Non-canonical genres before: ${nonCanon}. Rows changed: ${changes.length} (genre ${changes.filter(c => c.oldGenre !== c.newGenre).length}, tags ${changes.filter(c => c.oldTags.join() !== c.newTags.join()).length}).`);
for (const c of changes.slice(0, 25)) {
  console.log(`  ${c.date} ${JSON.stringify((c.name || '').slice(0, 40))} | ${c.oldGenre} → ${c.newGenre} | [${c.oldTags.join(', ')}] → [${c.newTags.join(', ')}]`);
}

if (DRY) { console.log('DRY run — nothing written.'); process.exit(0); }
if (SNAPSHOT) { console.error('❌  --snapshot is read-only: combine it with --dry-run.'); process.exit(1); }
if (!changes.length) { console.log('Nothing to update.'); process.exit(0); }
if (!sbClient) process.exit(1);

// ── Write (only changed rows, batched in parallel groups) ────────────────────────
let updated = 0, failed = 0;
for (let i = 0; i < changes.length; i += 12) {
  await Promise.all(changes.slice(i, i + 12).map(c =>
    withRetry(() => sbClient.from('events').update(c.patch).eq('id', c.id), `Update event ${c.id}`, 3, 2000)
      .then(({ error }) => { if (error) { failed++; console.error(`  ❌ ${c.id}: ${error.message || error}`); } else updated++; })));
}
console.log(`✓ classify: updated ${updated}/${changes.length} events${failed ? ` · ${failed} failed` : ''}.`);
process.exit(failed ? 1 : 0);
