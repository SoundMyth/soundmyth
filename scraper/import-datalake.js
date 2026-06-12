/**
 * SoundMyth – Datalake Importer
 *
 * Regenerates the scraper source lists from a curated Datalake snapshot
 * (`Datalake/SoundMyth <date>.xlsx`) while PRESERVING the fields that the
 * weekly pipeline enriches automatically (sk_url, ra_url, sk_venue_url, …).
 *
 * Matching between the spreadsheet and the existing JSON is done by a
 * normalised name key (NFD + strip diacritics + lowercase + trim), the same
 * normalisation used across the repo.
 *
 *   Clubs      → rebuilt from the `Clubs` sheet (re-ranked 1..N), enrichment
 *                carried over by name; ra_url falls back to the sheet's RA
 *                column when the JSON has none.
 *   Festivals  → existing entries get city/country/website/date_raw refreshed
 *                from the sheet; sk_url and order are preserved (no add/remove).
 *   Artists    → existing entries get tour_web refreshed and bit_url/ra_url/
 *                songkick_url filled only when empty; the extra hand-added
 *                artists (rank > 504) and canonical spellings are kept as-is.
 *
 * Also regenerates clubs_top100.json / festivals_top100.json (rank ≤ 100).
 *
 * Usage:  node import-datalake.js ["../../Datalake/SoundMyth 09.05.2026.xlsx"]
 * Output: writes back to data/*.json
 */

import XLSX from 'xlsx';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = (f) => resolve(__dirname, 'data', f);
const DEFAULT_XLSX = resolve(__dirname, '../../Datalake/SoundMyth 09.05.2026.xlsx');
const XLSX_PATH = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : DEFAULT_XLSX;

const norm = (s) => String(s == null ? '' : s)
  .trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const clean = (s) => String(s == null ? '' : s).trim();
const isUrl = (s) => /^https?:\/\//i.test(clean(s));
const isRaUrl = (s) => /ra\.co\//i.test(clean(s));
const readJson = (f) => JSON.parse(readFileSync(DATA(f), 'utf8'));
const writeJson = (f, obj) => writeFileSync(DATA(f), JSON.stringify(obj, null, 2) + '\n', 'utf8');

console.log('╔══════════════════════════════════════════╗');
console.log('║  SoundMyth – Datalake Importer           ║');
console.log('╚══════════════════════════════════════════╝');
console.log(`\n📒  Source: ${XLSX_PATH}\n`);

const wb = XLSX.readFile(XLSX_PATH);
const sheet = (name, opts = {}) => XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: null, ...opts });

// ── CLUBS ─────────────────────────────────────────────────────────────────────
function importClubs() {
  const prev = readJson('clubs_all.json');
  const prevByName = new Map(prev.map(c => [norm(c.name), c]));
  const rows = sheet('Clubs').filter(r => clean(r.Club));

  let newCount = 0, raKept = 0, raFromSheet = 0, skKept = 0;
  const out = rows.map(r => {
    const name = clean(r.Club);
    const p = prevByName.get(norm(name));
    let ra_url = clean(p?.ra_url);
    if (ra_url) raKept++;
    // Fall back to the sheet's RA column (col H → __EMPTY_1) when JSON has none
    if (!ra_url && isRaUrl(r.__EMPTY_1)) { ra_url = clean(r.__EMPTY_1); raFromSheet++; }
    const sk_venue_url = clean(p?.sk_venue_url);
    if (sk_venue_url) skKept++;
    if (!p) newCount++;
    return {
      ranking: r.Ranking,
      name,
      city: clean(r.City),
      country: clean(r.Country),
      website: clean(r.Website),
      ra_url,
      sk_venue_url,
    };
  });

  writeJson('clubs_all.json', out);
  const top100 = out.filter(c => Number(c.ranking) <= 100)
    .map(({ ranking, name, city, country, website, ra_url }) => ({ ranking, name, city, country, website, ra_url }));
  writeJson('clubs_top100.json', top100);

  console.log(`CLUBS      : ${out.length} written (${newCount} new) | ra_url kept ${raKept} +${raFromSheet} from sheet | sk_venue_url kept ${skKept} | top100 ${top100.length}`);
  const newOnes = out.filter(c => !prevByName.has(norm(c.name)));
  newOnes.forEach(c => console.log(`             + #${c.ranking} ${c.name} (${c.city}, ${c.country})${c.ra_url ? ' [ra ✓]' : ' [ra –]'}`));
  return out;
}

// ── FESTIVALS ───────────────────────────────────────────────────────────────
function importFestivals() {
  const prev = readJson('festivals_all.json');
  // Match by RANKING, not name: 15 festival brands repeat across cities/editions
  // (Untold, Time Warp ×4, Beyond Wonderland ×3 …). Rankings are unique 1..262
  // in both the sheet and the JSON, and align 1:1 (festivals weren't re-ranked).
  const xByRank = new Map(sheet('Festivals').filter(r => clean(r.Festival)).map(r => [r.Ranking, r]));

  let upd = 0;
  for (const f of prev) {
    const r = xByRank.get(f.ranking);
    if (!r) continue;
    let touched = false;
    const apply = (key, val) => {
      val = clean(val);
      if (val && val !== clean(f[key])) { f[key] = val; touched = true; }
    };
    apply('city', r.City);
    apply('country', r.Country);
    apply('website', r.Webiste);          // sheet header is misspelled "Webiste"
    apply('date_raw', r.Date);
    if (touched) upd++;
  }

  writeJson('festivals_all.json', prev);
  const top100 = prev.filter(c => Number(c.ranking) <= 100)
    .map(({ ranking, name, city, country, website, date_raw }) => ({ ranking, name, city, country, website, date_raw }));
  writeJson('festivals_top100.json', top100);

  console.log(`FESTIVALS  : ${prev.length} kept | ${upd} updated fields (sk_url preserved) | top100 ${top100.length}`);
  return prev;
}

// ── ARTISTS ───────────────────────────────────────────────────────────────────
function importArtists() {
  const prev = readJson('artists_all.json');
  // Artists 2025 sheet: header is on row 3 → range:2
  const xByName = new Map(
    sheet('Artists 2025', { range: 2 }).filter(r => clean(r.Artist)).map(r => [norm(r.Artist), r])
  );

  let tour = 0, bit = 0, ra = 0, sk = 0;
  for (const a of prev) {
    const r = xByName.get(norm(a.name));
    if (!r) continue;
    const tw = clean(r['Tour web']);
    if (isUrl(tw) && tw !== clean(a.tour_web)) { a.tour_web = tw; tour++; }
    const skv = clean(r['Alternativa 1 (Songkick)']);
    if (isUrl(skv) && !clean(a.songkick_url)) { a.songkick_url = skv; sk++; }
    const bitv = clean(r['Alternativa 2 (Bandsintown)']);
    if (isUrl(bitv) && !clean(a.bit_url)) { a.bit_url = bitv; bit++; }
    const rav = clean(r['Alternativa 3 (RA)']);
    if (isUrl(rav) && !clean(a.ra_url)) { a.ra_url = rav; ra++; }
  }

  writeJson('artists_all.json', prev);
  console.log(`ARTISTS    : ${prev.length} kept | tour_web ${tour} | songkick +${sk} | bit +${bit} | ra +${ra} (no new artists)`);
  return prev;
}

importClubs();
importFestivals();
importArtists();
console.log('\n✅  Done. Review `git diff data/` before committing.');
