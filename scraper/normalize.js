/**
 * SoundMyth – shared event normalization for the scrapers.
 * Mirrors the frontend (index.html) so the DB is clean at the source:
 *  - canonCity: fold city aliases / local-script names into one recognizable name
 *  - cleanVenue: drop a garbage venue that just repeats the event name (Bandsintown)
 *  - looksLikeBareArtist: a single-act listing with no real venue (not a festival)
 *  - cleanEvent: apply the above in-place before upsert
 */

import { transliterate } from 'transliteration';

// Keys written in their natural form; lowercased at init to match canonCity().
export const CITY_ALIAS_RAW = {
  'München':'Munich','Köln':'Cologne','Wien':'Vienna','Lisboa':'Lisbon','Milano':'Milan','Roma':'Rome','Firenze':'Florence','Napoli':'Naples','Torino':'Turin','Venezia':'Venice','Genève':'Geneva','Praha':'Prague','Warszawa':'Warsaw','Moskva':'Moscow','Sevilla':'Seville','Antwerpen':'Antwerp','Gent':'Ghent','Bruxelles':'Brussels','Den Haag':'The Hague','København':'Copenhagen','Göteborg':'Gothenburg',
  'Eivissa':'Ibiza','Sant Jordi De Ses Salines':'Ibiza','Sant Josep de sa Talaia':'Ibiza',
  'Sant Antoni de Portmany':'Ibiza','Santa Eulària des Riu':'Ibiza',
  'София':'Sofia','İstanbul':'Istanbul','Beşiktaş':'Istanbul','Beyoğlu':'Istanbul',
  'București':'Bucharest','Rīga':'Riga','Chișinău':'Chisinau','Bakı':'Baku',
  'Hlavní Město Praha':'Prague','Staré Město':'Prague','Brno-město':'Brno',
  'Wrocław':'Wroclaw','Gdańsk':'Gdansk','Łódź':'Lodz','Poznań':'Poznan','Płock':'Plock',
  'Białystok':'Bialystok','Międzyzdroje':'Miedzyzdroje','Łaziska Górne':'Laziska Gorne',
  'Włoszakowice':'Wloszakowice','Iłowa':'Ilowa',
  'Târgu Mureș':'Targu Mures','Bonțida':'Bontida','Costinești':'Costinesti',
  'Nevşehir Merkez':'Nevsehir','Çeşme':'Cesme',
  'Trenčín':'Trencin','Trenčín District':'Trencin','Velešín':'Velesin','Týn Nad Bečvou':'Tyn nad Becvou',
  'Horní Soběšovice':'Horni Sobesovice','Kaluža':'Kaluza','Liepāja':'Liepaja','Tjentište':'Tjentiste',
  'Città Metropolitana Di Messina':'Messina','Zrće Beach':'Novalja',
  'Παραλία Paradise':'Mykonos','Μύκονος':'Mykonos','Κάβος':'Kavos','Λαγανάς':'Laganas',
  '福岡市':'Fukuoka','大阪府':'Osaka','京都市':'Kyoto','横浜市':'Yokohama','名古屋市':'Nagoya',
  '札幌市':'Sapporo','仙台市':'Sendai','岡山市':'Okayama','宇都宮市':'Utsunomiya','渋谷区':'Tokyo','群馬県':'Gunma',
  'Dubai International Financial Centre':'Dubai',
  'Aeropuerto Internacional De La Ciudad De México':'Mexico City',
  'Masākin Maḩaţţat Kahrabā’ Sharq Al Qāhirah':'Cairo',
  'BELVOIR CASTLE Leicestershire':'Leicestershire'
};

const CITY_ALIAS = {};
for (const k in CITY_ALIAS_RAW) CITY_ALIAS[k.replace(/\s+/g,' ').trim().toLowerCase()] = CITY_ALIAS_RAW[k];

export function canonCity(c) {
  const t = (c || '').replace(/\s+/g, ' ').trim();
  if (!t) return t;
  const alias = CITY_ALIAS[t.toLowerCase()];
  if (alias) return alias;                       // explicit alias wins (standard English names)
  // fold to ASCII so accent/script variants collapse to ONE spelling
  // (Malaga/Málaga, Montréal->Montreal, Zürich->Zurich; non-Latin gets romanized)
  const tr = transliterate(t).replace(/\s+/g, ' ').trim();
  return tr || t;
}

// Country full-name variants → canonical name. The scrapers already map ISO codes
// (US→United States) via their own COUNTRY_ISO; this folds the long-form variants
// Songkick/RA return (United States of America, Czech Republic, Korea, Republic Of…)
// so the raw DB is clean at source — not only after the weekly validate.js runs.
export const COUNTRY_NORM = {
  'UK': 'United Kingdom', 'US': 'United States', 'USA': 'United States', 'Usa': 'United States',
  'UAE': 'United Arab Emirates', 'EAU': 'United Arab Emirates',
  'United States of America': 'United States',
  'United Kingdom of Great Britain and Northern Ireland': 'United Kingdom',
  'Korea': 'South Korea', 'Republic of Korea': 'South Korea',
  'Korea, Republic Of': 'South Korea', 'Korea, Republic of': 'South Korea',
  'Northern Ireland': 'United Kingdom',
  'Czech Republic': 'Czechia', 'Türkiye': 'Turkey', "Côte d'Ivoire": 'Ivory Coast',
  'Taiwan, Province of China': 'Taiwan', 'Viet Nam': 'Vietnam', 'Russian Federation': 'Russia',
  '日本': 'Japan', 'Bosnia And Herzegovina': 'Bosnia and Herzegovina', 'Netherlands Antilles': 'Netherlands',
};
export function canonCountry(c) {
  const t = (c || '').replace(/\s+/g, ' ').trim();
  return t ? (COUNTRY_NORM[t] || t) : t;
}

export function cleanVenue(venue, name) {
  const v = (venue || '').trim();
  return (v && v === (name || '').trim()) ? '' : v;
}

/** A single-act listing whose "venue" only repeats the title — not a real festival/venue event. */
export function looksLikeBareArtist(ev) {
  return !cleanVenue(ev.venue, ev.name) && (!ev.djs || ev.djs.length <= 1);
}

/** Normalize an event row in place, just before upsert. */
export function cleanEvent(e) {
  e.city    = canonCity(e.city);
  e.country = canonCountry(e.country);
  e.venue   = cleanVenue(e.venue, e.name);
  return e;
}

// ── DJ name canonicalization (data-driven; mirror of the frontend) ──────────────
export function djNorm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}
/** From {display:count}, prefer Title-case (not ALL-CAPS), then diacritics, then frequency. */
export function pickCanon(variants) {
  let best = null, bestScore = -Infinity;
  for (const v in variants) {
    let sc = variants[v] * 0.001;
    if (/[a-zà-ÿ]/.test(v) && /[A-ZÀ-Þ]/.test(v)) sc += 3;
    if (/[À-ÿ]/.test(v)) sc += 1;
    if (sc > bestScore) { bestScore = sc; best = v; }
  }
  return best;
}
/** Build {normalized → canonical display} from all rows' djs[]. */
export function buildDjCanon(rows) {
  const variants = {};
  for (const e of rows) for (const dj of (e.djs || [])) {
    const k = djNorm(dj); if (!k) continue;
    (variants[k] = variants[k] || {})[dj] = (variants[k][dj] || 0) + 1;
  }
  const map = {};
  for (const k in variants) map[k] = pickCanon(variants[k]);
  return map;
}
