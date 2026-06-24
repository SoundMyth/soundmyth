/**
 * SoundMyth – infer a style for discovered DJs from who they share bills with.
 *
 * Promoted/discovered DJs (tags:'discovered') land with a generic genre 'Electronic'
 * because we don't know their sound yet. Rather than hit RA (rate-limited), this infers
 * it from co-billing: a DJ that repeatedly plays alongside Tech House / Techno acts we
 * DO know is almost certainly that sound. We take the most common style among the
 * known-style DJs on the same events and write it into the discovered DJ's `genre`
 * (which canonStyle round-trips: canonStyle('Tech House','') === 'Tech House').
 *
 * Read-only on the DB (anon key from ../index.html); writes data/artists_all.json.
 * Safe to re-run. Set DRY=1 to preview.
 *
 * Usage: node infer-styles.js   (DRY=1 node infer-styles.js to preview)
 */
import { readFileSync, writeFileSync } from 'fs';
import { createClient }               from '@supabase/supabase-js';
import { fileURLToPath }              from 'url';
import { dirname, resolve }           from 'path';
import { canonStyle }                 from './normalize.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const djKey = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
                            .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '');

const ALL_PATH = resolve(__dirname, 'data/artists_all.json');
const all = JSON.parse(readFileSync(ALL_PATH, 'utf8'));

// Known-style DJs = anything that already resolves to a real (non-Electronic) style.
const known = {};
for (const a of all) {
  const st = canonStyle(a.genre, a.subgenre);
  if (st && st !== 'Electronic') known[djKey(a.name)] = st;
}
// Discovered DJs still lacking a real style.
const discSet = new Set();
for (const a of all) if (canonStyle(a.genre, a.subgenre) === 'Electronic') discSet.add(djKey(a.name));
console.log(`artists_all: ${all.length} · known-style: ${Object.keys(known).length} · still generic: ${discSet.size}`);

// Anon read of future events (no secrets).
const html   = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
const sb = createClient((html.match(/SB_URL\s*=\s*['"]([^'"]+)['"]/) || [])[1],
                        (html.match(/SB_KEY\s*=\s*['"]([^'"]+)['"]/) || [])[1], { auth: { persistSession: false } });
const TODAY = new Date().toISOString().split('T')[0];
let rows = [], from = 0;
while (true) {
  const { data, error } = await sb.from('events').select('djs').gte('date', TODAY).range(from, from + 999);
  if (error) { console.error(error.message); process.exit(1); }
  rows = rows.concat(data); if (data.length < 1000) break; from += 1000;
}

// Tally co-bill styles per discovered DJ.
const tally = {};
for (const e of rows) {
  const billStyles = (e.djs || []).map(d => known[djKey(d)]).filter(Boolean);
  if (!billStyles.length) continue;
  for (const d of (e.djs || [])) {
    const k = djKey(d);
    if (!discSet.has(k)) continue;
    const t = (tally[k] = tally[k] || {});
    for (const s of billStyles) t[s] = (t[s] || 0) + 1;
  }
}

let inferred = 0;
for (const a of all) {
  const k = djKey(a.name);
  if (!discSet.has(k) || !tally[k]) continue;
  const [best, n] = Object.entries(tally[k]).sort((x, y) => y[1] - x[1])[0];
  if (process.env.DRY === '1') { if (inferred < 30) console.log(`  ${a.name} → ${best} (${n} co-bills)`); }
  else a.genre = best;
  inferred++;
}

if (process.env.DRY === '1') console.log(`DRY · would infer a style for ${inferred} discovered DJs. No file written.`);
else { writeFileSync(ALL_PATH, JSON.stringify(all, null, 2) + '\n'); console.log(`✓ Inferred style for ${inferred} discovered DJs (still generic: ${discSet.size - inferred}). artists_all written.`); }
