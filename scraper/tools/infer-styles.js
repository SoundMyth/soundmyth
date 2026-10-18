/**
 * SoundMyth – infer a canonical style for DJs that have none yet, from who they share bills with.
 *
 * DJs without a valid style (genre '' or not one of the 16 canonical styles, e.g. freshly
 * promoted by promote-candidates.js) get the most common style among the already-classified
 * DJs on the same upcoming events. Output is ALWAYS a canonical style from genres.js — never
 * 'Electronic' or a legacy label. This is a suggestion: review docs/genre-audit-*.md and
 * correct by hand when it matters.
 *
 * Read-only on the DB (anon key from ../../index.html); writes data/artists_all.json.
 * Safe to re-run. Set DRY=1 to preview.
 *
 * Usage: node infer-styles.js   (DRY=1 node infer-styles.js to preview)
 */
import { readFileSync, writeFileSync } from 'fs';
import { createClient }               from '@supabase/supabase-js';
import { fileURLToPath }              from 'url';
import { dirname, resolve }           from 'path';
import { djKey, djStyle }             from '../lib/genres.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ALL_PATH = resolve(__dirname, '../data/artists_all.json');
const all = JSON.parse(readFileSync(ALL_PATH, 'utf8'));

// Known = already has a valid canonical style. Unknown = needs one.
const known = {};
const unknown = new Set();
for (const a of all) {
  const st = djStyle(a.genre, a.subgenre);
  if (st) known[djKey(a.name)] = st; else unknown.add(djKey(a.name));
}
console.log(`artists_all: ${all.length} · known style: ${Object.keys(known).length} · unknown: ${unknown.size}`);

// Anon read of upcoming events (no secrets).
const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');
const sb = createClient((html.match(/SB_URL\s*=\s*['"]([^'"]+)['"]/) || [])[1],
                        (html.match(/SB_KEY\s*=\s*['"]([^'"]+)['"]/) || [])[1], { auth: { persistSession: false } });
const TODAY = new Date().toISOString().split('T')[0];
let rows = [], from = 0;
while (true) {
  const { data, error } = await sb.from('events').select('djs').gte('date', TODAY).range(from, from + 999);
  if (error) { console.error(error.message); process.exit(1); }
  rows = rows.concat(data); if (data.length < 1000) break; from += 1000;
}

// Tally co-bill styles per unknown DJ.
const tally = {};
for (const e of rows) {
  const djs = e.djs || [];
  const billStyles = djs.map(d => known[djKey(d)]).filter(Boolean);
  if (!billStyles.length) continue;
  for (const d of djs) {
    const k = djKey(d);
    if (!unknown.has(k)) continue;
    const t = (tally[k] = tally[k] || {});
    for (const s of billStyles) t[s] = (t[s] || 0) + 1;
  }
}

let inferred = 0;
for (const a of all) {
  const k = djKey(a.name);
  if (!unknown.has(k) || !tally[k]) continue;
  const [best, n] = Object.entries(tally[k]).sort((x, y) => y[1] - x[1])[0];
  if (process.env.DRY === '1') { if (inferred < 30) console.log(`  ${a.name} → ${best} (${n} co-bills)`); }
  else a.genre = best;
  inferred++;
}

if (process.env.DRY === '1') console.log(`DRY · would infer a style for ${inferred} unknown DJs. No file written.`);
else { writeFileSync(ALL_PATH, JSON.stringify(all, null, 2) + '\n'); console.log(`✓ Inferred style for ${inferred} unknown DJs (still unknown: ${unknown.size - inferred}). artists_all written.`); }
