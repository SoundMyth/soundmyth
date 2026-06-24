/**
 * SoundMyth – promote discovered EDM DJs into the curated list.
 *
 * discover-djs.js surfaces electronic DJs we don't track yet into
 * data/artists_candidates.json (onRA:true = verified on Resident Advisor). This
 * tool appends the active ones (≥ MIN_EVENTS distinct shows) to artists_all.json
 * so scrape-extended.js searches their tours directly — i.e. it grows coverage by
 * editing the ONE list, exactly the SoundMyth model.
 *
 * Safe to re-run: idempotent (skips names already in the list), honours the manual
 * block-list, strips Resident-Advisor region suffixes (" (UK)", " (DE)", " (2)")
 * and dedupes so "James Hype (UK)" doesn't double "James Hype".
 *
 * Usage: node promote-candidates.js            (default MIN_EVENTS=4)
 *        MIN_EVENTS=6 node promote-candidates.js
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath }               from 'url';
import { dirname, resolve }            from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rd = p => JSON.parse(readFileSync(resolve(__dirname, p), 'utf8'));
const djKey = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
                              .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '');
const stripRegion = n => n.replace(/\s*\((?:[A-Z]{1,3}|[A-Z][a-z]+|\d+)\)\s*$/, '').trim();

const MIN   = Number(process.env.MIN_EVENTS || 4);
const all   = rd('data/artists_all.json');
const BLOCK = new Set(rd('data/artists_block.json').map(djKey));
const cand  = rd('data/artists_candidates.json');

const seen = new Set(all.map(a => djKey(a.name)));   // existing list (dup guard)
let next   = Math.max(0, ...all.map(a => a.ranking || 0));
const added = [];

for (const c of cand.filter(c => c.onRA && c.events >= MIN).sort((a, b) => b.events - a.events)) {
  if (BLOCK.has(c.key || djKey(c.name))) continue;
  const name = stripRegion(c.name);
  const k = djKey(name);
  if (!k || seen.has(k)) continue;        // empty, dup vs list, or suffix-merge dup
  seen.add(k);
  added.push({ ranking: ++next, name, genre: 'Electronic', subgenre: '',
               tags: 'discovered', tour_web: '', songkick_url: '', bit_url: '', ra_url: '' });
}

if (process.env.DRY === '1') {
  console.log(`DRY · would promote ${added.length} DJs (events>=${MIN}). No file written.`);
} else {
  all.push(...added);
  writeFileSync(resolve(__dirname, 'data/artists_all.json'), JSON.stringify(all, null, 2) + '\n');
  console.log(`✓ Promoted ${added.length} discovered EDM DJs (events>=${MIN}). artists_all: ${all.length}.`);
}
added.forEach(a => console.log('  +', a.name));
