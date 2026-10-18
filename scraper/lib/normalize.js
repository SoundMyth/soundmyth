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
  'Greenwich Peninsula':'London','Cullera Beach':'Cullera','Sydney Olympic Park':'Sydney','Moore Park':'Sydney','Playa Duque Marbella':'Marbella','Pag Island':'Novalja','Kings Heath':'Birmingham','Long Island City':'New York','Forest Hills':'New York','Fortitude Valley':'Brisbane','Paradise Island':'Nassau','Marina Di Pisa':'Pisa','Campo Pequeno':'Lisbon','Port Melbourne':'Melbourne',
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
  'BELVOIR CASTLE Leicestershire':'Leicestershire',
  // boroughs / local spellings folded into the English city
  'Brooklyn':'New York','Manhattan':'New York','Queens':'New York','The Bronx':'New York','Bronx':'New York',
  'Staten Island':'New York','New York City':'New York','NYC':'New York',
  'Tokio':'Tokyo',
  'Ciudad De Mexico':'Mexico City','Ciudad de Mexico':'Mexico City','Ciudad de México':'Mexico City','CDMX':'Mexico City',
  'St Polten':'St. Polten','St. Pölten':'St. Polten','Sankt Pölten':'St. Polten','Sankt Polten':'St. Polten',
};

// Scraper-only folds (sub-areas, local spellings). Kept OUT of CITY_ALIAS_RAW because that
// object is mirrored verbatim in index.html and test/maps-sync.test.js enforces the match.
// RA / BIT area labels that are not cities ("All" = every area of a country).
const NOT_A_CITY = new Set(['all','all areas','tba','tbc','tbd','n/a','na','none','unknown','various','various cities','-','--','—']);

const CITY_ALIAS = {};
for (const k in CITY_ALIAS_RAW) CITY_ALIAS[k.replace(/\s+/g,' ').trim().toLowerCase()] = CITY_ALIAS_RAW[k];

function titleCaseCity(s) { return s.toLowerCase().replace(/(^|[\s\-/])([a-z])/g, (m, p, c) => p + c.toUpperCase()); }
export function canonCity(c) {
  let t = (c || '').replace(/\s+/g, ' ').trim();
  if (!t) return t;
  if (NOT_A_CITY.has(t.toLowerCase())) return '';   // "All" is an RA area, never a city
  t = t.replace(/\s*\([A-Z]{2,4}\)$/, '').trim();   // drop nickname acronyms: "New York (NYC)" → "New York" (keeps "(oder)")
  if (t.includes(',')) t = t.split(',')[0].trim();  // "Theale, Berkshire" / "Guernsey, Channel Islands" → city before the region
  t = t.replace(/\s+(Municipality|District|County|Province|Region|Metropolitan Area|Prefecture)$/i, '').trim();  // "Copenhagen Municipality" → "Copenhagen"
  t = t.replace(/^Provincia [Dd]i\s+/i, '').replace(/^Downtown\s+/i, '').replace(/\s+(Downtown|City Cent(?:re|er)|Centro)$/i, '').trim();  // "Provincia Di Brescia"→Brescia, "Downtown Brooklyn"→Brooklyn, "Santiago Centro"→Santiago
  t = t.replace(/^Praha(?:\s+\d+)?$/i, 'Prague');   // "Praha" / "Praha 9" → Prague
  if (!t) return t;
  const alias = CITY_ALIAS[t.toLowerCase()];
  if (alias) return alias;                          // explicit alias wins (standard English names)
  // fold to ASCII so accent/script variants collapse (Malaga/Málaga, Montréal→Montreal,
  // Zürich→Zurich; non-Latin romanized) AND Title-case so caps/hyphen-case variants merge
  // (BOCHUM/Bochum, Rio de/De Janeiro, Cluj-napoca/Napoca).
  const tr = transliterate(t).replace(/\s+/g, ' ').trim();
  return tr ? titleCaseCity(tr) : t;
}

// Country full-name variants → canonical name. The scrapers already map ISO codes
// (US→United States) via their own COUNTRY_ISO; this folds the long-form variants
// Songkick/RA return (United States of America, Czech Republic, Korea, Republic Of…)
// so the raw DB is clean at source — not only after the weekly steps/12-validate.js runs.
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
// Canonical country names we accept (moved here from steps/12-validate.js so there is one list).
export const VALID_COUNTRIES = new Set([
  'United Kingdom', 'United States', 'Spain', 'Germany', 'France', 'Italy',
  'Netherlands', 'Belgium', 'Portugal', 'Greece', 'Croatia', 'Serbia',
  'Romania', 'Bulgaria', 'Austria', 'Switzerland', 'Sweden', 'Norway',
  'Denmark', 'Finland', 'Ireland', 'Poland', 'Czechia',
  'Hungary', 'Turkey', 'Australia', 'Japan', 'South Korea', 'Thailand',
  'Indonesia', 'India', 'Brazil', 'Argentina', 'Colombia', 'Mexico',
  'Canada', 'South Africa', 'Morocco', 'Egypt', 'Israel', 'Lebanon',
  'United Arab Emirates', 'Georgia', 'Ukraine', 'Russia', 'China',
  'Singapore', 'Malaysia', 'Philippines', 'Vietnam', 'New Zealand',
  'Chile', 'Peru', 'Costa Rica', 'Jamaica', 'Dominican Republic',
  'Puerto Rico', 'Iceland', 'Estonia', 'Latvia', 'Lithuania', 'Slovenia',
  'Slovakia', 'Malta', 'Cyprus', 'Luxembourg', 'Montenegro', 'Albania',
  'North Macedonia', 'Bosnia and Herzegovina',
  'Taiwan', 'Hong Kong', 'Paraguay', 'Monaco', 'Tunisia', 'Cambodia',
  'Moldova', 'Azerbaijan', 'Armenia', 'Kazakhstan', 'Uzbekistan',
  'Kyrgyzstan', 'Bolivia', 'Ecuador', 'Kenya', 'Nepal', 'Iran',
  'Ivory Coast', 'Saint Martin', 'Saint Barthélemy', 'Anguilla', 'Belarus', 'Kosovo', 'Macau',
  'Panama', 'Uruguay', 'Venezuela', 'Honduras', 'El Salvador',
  'Nicaragua', 'Cuba', 'Trinidad and Tobago', 'Qatar', 'Kuwait',
  'Bahrain', 'Oman', 'Saudi Arabia', 'Jordan', 'Iraq', 'Palestine',
  'Nigeria', 'Ghana', 'Tanzania', 'Ethiopia', 'Uganda', 'Senegal',
  'Pakistan', 'Bangladesh', 'Sri Lanka', 'Myanmar', 'Laos', 'Mongolia',
  'Maldives', 'Curaçao',
]);
const foldKey = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const COUNTRY_BY_FOLD = new Map([...VALID_COUNTRIES].map(c => [foldKey(c), c]));

export function canonCountry(c) {
  const t = (c || '').replace(/\s+/g, ' ').trim();
  if (!t) return t;
  if (COUNTRY_NORM[t]) return COUNTRY_NORM[t];
  if (VALID_COUNTRIES.has(t)) return t;
  return COUNTRY_BY_FOLD.get(foldKey(t)) || t;   // "Saint BarthÉlemy" → "Saint Barthélemy"
}

export function cleanVenue(venue, name) {
  const v = (venue || '').trim();
  return (v && v === (name || '').trim()) ? '' : v;
}

/** A single-act listing whose "venue" only repeats the title — not a real festival/venue event. */
export function looksLikeBareArtist(ev) {
  return !cleanVenue(ev.venue, ev.name) && (!ev.djs || ev.djs.length <= 1);
}

/** Normalize an event row in place, just before upsert (geo canon + hub fill, venue, lineup). */
export function cleanEvent(e) {
  const g = resolveGeo(e);
  e.city    = g.city;
  e.country = g.country;
  e.venue   = cleanVenue(e.venue, e.name);
  e.djs     = cleanLineup(e.djs);
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

// ── Shared text helpers ───────────────────────────────────────────────────────────
/** Accent-, case- and punctuation-insensitive text key ("Tinker Field" ≡ "tinker-field"). */
export function normText(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

// ── Geography (contract §6) ───────────────────────────────────────────────────────
/** Major EDM hubs → their country. A hub name listed under another country is either a
 *  real homonym (HUB_HOMONYM_OK) or a bad geocode; resolveGeo() only corrects the latter
 *  when the venue itself is known to sit in the hub country. */
export const HUB_COUNTRY = {
  'Amsterdam':'Netherlands','Rotterdam':'Netherlands','Berlin':'Germany','Munich':'Germany',
  'Cologne':'Germany','Hamburg':'Germany','Barcelona':'Spain','Madrid':'Spain','Ibiza':'Spain',
  'Valencia':'Spain','Paris':'France','London':'United Kingdom','Brussels':'Belgium','Ghent':'Belgium',
  'Antwerp':'Belgium','Lisbon':'Portugal','Milan':'Italy','Rome':'Italy','Vienna':'Austria',
  'Zurich':'Switzerland','Prague':'Czechia','Budapest':'Hungary','Copenhagen':'Denmark',
  'Stockholm':'Sweden','Mykonos':'Greece','Tokyo':'Japan','Seoul':'South Korea','Shanghai':'China',
  'Bangkok':'Thailand','Singapore':'Singapore','Sydney':'Australia','Melbourne':'Australia',
  'Dubai':'United Arab Emirates','Tel Aviv':'Israel','Mexico City':'Mexico','Miami':'United States',
  'Las Vegas':'United States','New York':'United States','Los Angeles':'United States',
  'Chicago':'United States','Sao Paulo':'Brazil','Buenos Aires':'Argentina',
};
/** Real homonyms: these hub names do exist in the listed countries, so keep them as-is. */
export const HUB_HOMONYM_OK = {
  'London':['Canada'], 'Paris':['United States'], 'Berlin':['United States'],
  'Vienna':['United States'], 'Melbourne':['United States'], 'Sydney':['Canada'],
};

/** Grouping key for "same city" comparisons (after canonicalisation). */
export function cityKey(city) { return canonCity(city).toLowerCase(); }

/** Club lookup from data/clubs_all.json: exact (normalised) venue name → {city, country}.
 *  Exact match only: a prefix match would send "Pacha New York" to Pacha Ibiza. */
export function makeClubLookup(clubs) {
  const byName = new Map();
  for (const c of clubs || []) {
    const k = normText(c.name);
    if (k && !byName.has(k)) byName.set(k, { city: c.city || '', country: canonCountry(c.country || '') });
  }
  return venue => byName.get(normText(venue)) || null;
}

/**
 * Resolve canonical city + country for one event (pure). `clubLookup(venue)` is optional:
 * it gives the venue's known city (RA "All" areas, empty cities) and is the evidence needed
 * before a hub mismatch is corrected. Returns what happened so callers can count it.
 */
// A city named like its own country is either a city-state / territory (the city IS the country:
// keep it) or a placeholder ("Germany" in Germany says nothing: blank it). "Mexico" in Mexico is
// the capital in practice.
const CITY_IS_COUNTRY_OK = new Set([
  'singapore', 'monaco', 'hong kong', 'macau', 'luxembourg', 'malta', 'gibraltar',
  'vatican city', 'san marino', 'saint martin', 'saint barthelemy', 'anguilla',
].map(normText));

export function resolveGeo(ev, clubLookup = () => null) {
  const origCity = (ev.city || '').trim();
  let city = canonCity(origCity);
  let country = canonCountry(ev.country || '');
  const out = { city: '', country: '', cityChanged: false, cityFallback: false,
                countryFilled: false, hubFixed: false, hubFlag: null };

  if (city && country && normText(city) === normText(country)) {
    if (normText(city) === 'mexico') city = 'Mexico City';
    else if (!CITY_IS_COUNTRY_OK.has(normText(city))) city = '';
  }

  if (!city) {
    const club = clubLookup(ev.venue);
    if (club?.city) {
      city = canonCity(club.city);
      out.cityFallback = !!city;
      if (!country && club.country) { country = canonCountry(club.country); out.countryFilled = true; }
    }
  }

  const hub = HUB_COUNTRY[city];
  if (hub) {
    if (!country) { country = hub; out.countryFilled = true; }
    else if (country !== hub && !(HUB_HOMONYM_OK[city] || []).includes(country)) {
      if (clubLookup(ev.venue)?.country === hub) { country = hub; out.hubFixed = true; }
      else out.hubFlag = `${city} listed in ${country}`;   // no venue evidence: flag, do not guess
    }
  }
  out.city = city;
  out.country = country;
  out.cityChanged = city !== origCity;
  return out;
}

// ── Lineup cleaner (junk names out, b2b split) ────────────────────────────────────
// Matched against the WHOLE name, so real artists such as "&ME", "ØTTA", "ÜBERKIKZ"
// and "ARTBAT" never match.
const JUNK_DJ_RE = [
  /^(?:&|and|\+|with)?\s*friends?$/i,           // "&friends", "and friends", "friends"
  /^special guests?$/i,
  /^(?:tba|tbc|tbd|tbh)$/i,
  /^to be (?:announced|confirmed)$/i,
  /^(?:more\s+)?(?:tba|tbc|to be announced|artists?)$/i,   // "more to be announced", "more TBA"
  /^(?:and\s+)?(?:many\s+)?more$/i,
  /^\+\s*\d*\s*more$/i,
  /^\.+$/, /^\?+$/,
  /^(?:vs\.?|versus|b2b|&|\+|-|–|\/|x)$/i,
  /^(?:live|guests?|various artists|various djs|multiple artists|unknown|n\/?a|none)$/i,
];

/** "A b2b B" / "A vs B" → ["A","B"]. */
function splitLineupItem(raw) {
  return String(raw || '').split(/\s+(?:b2b|vs\.?|versus)\s+/i);
}

/** Clean an event's lineup: split b2b/vs, drop junk placeholders, strip "(AU)"-style
 *  country tags and "& friends" suffixes, de-duplicate case-insensitively. */
export function cleanLineup(djs) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(djs) ? djs : []) {
    for (const part of splitLineupItem(raw)) {
      let s = part.replace(/\s+/g, ' ').trim();
      s = s.replace(/\s+(?:&|and|\+)\s+friends$/i, '').trim();
      s = s.replace(/\s+\([A-Z]{2,3}\)$/, '').trim();    // "Levi (AU)" → "Levi"
      if (s.length < 2) continue;
      if (JUNK_DJ_RE.some(re => re.test(s))) continue;
      const k = s.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(s);
    }
  }
  return out;
}

// ── Dates (contract §5) ────────────────────────────────────────────────────────────
export const MAX_AHEAD_MONTHS = 15;
const WEEKDAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const MONTH_ABBR = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const WEEKDAY_RE = '(?:(sunday|monday|tuesday|wednesday|thursday|friday|saturday)[,\\s]+)?';
// "Friday November 20th 2026" / "Nov 20" (month first)
const RE_MONTH_FIRST = new RegExp(`${WEEKDAY_RE}\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4}))?`, 'i');
// "Friday 20 November 2026" / "20th Nov" (day first)
const RE_DAY_FIRST = new RegExp(`${WEEKDAY_RE}\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}\\b\\.?(?:,?\\s+(\\d{4}))?`, 'i');
const RE_LEGACY_WEBSITE_NAME = new RegExp(`^\\s*(?:${WEEKDAYS.join('|')}),?\\s+${MONTH_RE}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}\\s+[-–—]`, 'i');

const pad2 = n => String(n).padStart(2, '0');
/** Calendar date → 'YYYY-MM-DD', or '' when it does not exist (Feb 30). */
function isoOf(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return '';
  return `${y}-${pad2(m)}-${pad2(d)}`;
}
function ymdOfUTC(dt) { return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`; }

export function isValidISODate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return false;
  const [y, m, d] = s.split('-').map(Number);
  return isoOf(y, m, d) === s;
}

/** Today's calendar date as 'YYYY-MM-DD' (local calendar; GitHub runners are UTC). */
export function todayISO(now = new Date()) {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/** Date-only arithmetic (UTC getters on a pure date: no timezone shift is possible). */
export function addDaysISO(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return ymdOfUTC(new Date(Date.UTC(y, m - 1, d + n)));
}
export function addMonthsISO(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return ymdOfUTC(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d, last))));
}
/** Whole days from a to b (b − a). */
export function daysBetween(a, b) {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 864e5);
}
export function weekdayName(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** The calendar date written at the start of an ISO string, taken literally (no timezone
 *  conversion). "2026-11-20T23:00:00-05:00" → "2026-11-20". '' when absent or impossible. */
export function localDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  return m ? isoOf(+m[1], +m[2], +m[3]) : '';
}
/** True for a timestamp expressed in UTC (…Z or +00:00): its date may differ from the local one. */
export function isUtcInstant(s) {
  return /T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]00:?00)$/i.test(String(s || ''));
}

/** Year inference for a yearless date (contract §5): this year, unless that is more than
 *  30 days in the past, in which case it belongs to next year. */
export function inferYearISO(month, day, today = todayISO()) {
  const y = +today.slice(0, 4);
  let d = isoOf(y, month, day);
  if (!d) return '';
  if (d < addDaysISO(today, -30)) d = isoOf(y + 1, month, day);
  return d;
}

/** Find a human-readable date in free text ("Friday November 20th 2026", "20 Nov", …).
 *  Returns {date, weekday, weekdayOk, explicitYear} or null. weekdayOk is null when no weekday. */
export function parseNamedDate(text, today = todayISO()) {
  const s = String(text || '');
  let wd, mon, day, yr;
  let m = RE_MONTH_FIRST.exec(s);
  if (m) { [, wd, mon, day, yr] = m; }
  else if ((m = RE_DAY_FIRST.exec(s))) { [, wd, day, mon, yr] = m; }
  else return null;
  const month = MONTH_ABBR.indexOf(mon.slice(0, 3).toLowerCase()) + 1;
  const dayN = +day;
  const date = yr ? isoOf(+yr, month, dayN) : inferYearISO(month, dayN, today);
  if (!date) return null;
  const weekday = wd ? wd.toLowerCase() : '';
  return { date, weekday, weekdayOk: weekday ? weekdayName(date) === weekday : null, explicitYear: !!yr };
}

/**
 * Resolve the date of a JSON-LD event (scrapers: tour sites, festival sites, Songkick).
 *  - a literal local date (no UTC marker) is taken as written;
 *  - a UTC timestamp (…Z) has an unknowable local date, so it is only used when the
 *    name carries an explicit date (the +1-day bug: "Friday November 20th 2026" stored 21st);
 *  - when the name's date (with a matching weekday) disagrees with startDate, the name wins.
 * Returns {date, via}; date '' means "cannot be dated reliably: skip the event".
 */
export function resolveLDDate(item, today = todayISO()) {
  const raw = String(item?.startDate || '');
  const ldDate = isUtcInstant(raw) ? '' : localDate(raw);
  const named = parseNamedDate(item?.name || '', today);
  const namedDate = named && named.weekdayOk !== false ? named.date : '';
  if (namedDate) return { date: namedDate, via: 'name' };
  if (ldDate) return { date: ldDate, via: 'startDate' };
  return { date: '', via: 'none' };
}

/** Strip a leading "Saturday October 17th 2026 - " date prefix from a page title. */
export function cleanEventTitle(title) {
  let t = String(title || '').replace(/\s+/g, ' ').trim();
  const m = RE_MONTH_FIRST.exec(t) || RE_DAY_FIRST.exec(t);
  if (m && m.index <= 3) t = t.slice(0, m.index) + t.slice(m.index + m[0].length);
  t = t.replace(/^\s*(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b[,\s]*/i, '');
  return t.replace(/^[\s\-–—:|,]+/, '').replace(/[\s\-–—:|,]+$/, '').trim();
}

/** Rows written by the pre-fix website scraper: name = "<weekday> <Month> <day> <year> - <title>". */
export function isLegacyWebsiteRow(ev) {
  return ev?.source === 'website' && RE_LEGACY_WEBSITE_NAME.test(String(ev.name || ''));
}

/** Date status for validation: 'invalid' | 'past' | 'too-far' (> 15 months) | 'ok'. */
export function checkEventDate(date, today = todayISO()) {
  if (!isValidISODate(date)) return 'invalid';
  if (date < today) return 'past';
  if (date > addMonthsISO(today, MAX_AHEAD_MONTHS)) return 'too-far';
  return 'ok';
}

// ── Festivals & double bookings (dedupe Pass 3b + Pass 6) ─────────────────────────
/** Predicate: does the event's name/venue contain a known festival's full name? */
export function makeFestivalTest(festNames = []) {
  const keys = [...new Set((festNames || []).map(normText).filter(n => n.length >= 5))];
  return ev => {
    const t = ' ' + normText(ev?.name) + ' ' + normText(ev?.venue) + ' ';
    return keys.some(k => t.includes(' ' + k + ' '));
  };
}

/** Venue of an event: the part after "@ "/" at " in the name, else the venue field. */
export function venueKeyOf(ev) {
  const m = String(ev?.name || '').match(/^.+?\s+(?:at|@)\s+(.+)$/i);
  return normText(m ? m[1] : (ev?.venue || ''));
}

/**
 * Pass 3b planner (pure). A festival "master" is a festival-named row with no lineup
 * (e.g. "Electric Daisy Carnival - EDC Orlando … @ Tinker Field", djs=[]). A "fragment" is a
 * non-festival-named row with DJs at the same venue and city, dated within `spanDays`
 * of the master (per-artist Songkick rows: "Martin Garrix @ Tinker Field").
 * Returns [{fragmentId, masterId}]; the caller applies it.
 */
export function planFestivalFragments(events, festNames, { spanDays = 4 } = {}) {
  const isFest = makeFestivalTest(festNames);
  const masters = [], fragments = [];
  for (const ev of events) {
    if (isFest(ev)) { if (!(ev.djs || []).length) masters.push(ev); }
    else if ((ev.djs || []).length) fragments.push(ev);
  }
  const plan = [];
  for (const f of fragments) {
    const fv = venueKeyOf(f), fc = cityKey(f.city);
    if (fv.length < 3 || !fc || !f.date) continue;
    let best = null, bestGap = Infinity;
    for (const m of masters) {
      if (!m.date || venueKeyOf(m) !== fv || cityKey(m.city) !== fc) continue;
      const gap = Math.abs(daysBetween(m.date, f.date));
      if (gap <= spanDays && gap < bestGap) { best = m; bestGap = gap; }
    }
    if (best) plan.push({ fragmentId: f.id, masterId: best.id });
  }
  return plan;
}

/** Source tier for double-booking priority (lower wins):
 *  0 = official / RA listing (ra, direct, website); 1 = Songkick/BIT single show;
 *  2 = festival per-artist fragment or festival listing. */
export function eventTier(ev, festival = false) {
  if (['ra', 'direct', 'website'].includes(ev?.source)) return 0;
  return festival ? 2 : 1;
}

/** DJ key for double-booking comparisons ("KI/KI" ≡ "ki ki" ≡ "Kiki"). */
export function djMatchKey(s) { return normText(s).replace(/\s+/g, ''); }

/**
 * Pass 6 detector (pure). The same DJ on the same date in events of DIFFERENT cities is a
 * conflict. Winner = lowest tier, then richest, then lowest id. Every event whose city differs
 * from the winner's is a loser (its DJ must be removed). Returns
 * [{ djKey, dj, date, winner, losers }].
 */
export function findDoubleBookings(events, { isFestival = () => false, richness = () => 0 } = {}) {
  const idx = new Map();
  for (const ev of events) {
    if (!cityKey(ev.city) || !ev.date) continue;
    for (const dj of ev.djs || []) {
      const dk = djMatchKey(dj);
      if (!dk) continue;
      const k = `${dk}|${ev.date}`;
      if (!idx.has(k)) idx.set(k, { djKey: dk, entries: new Map() });
      idx.get(k).entries.set(ev.id, { ev, dj });
    }
  }
  const out = [];
  for (const { djKey, entries: map } of idx.values()) {
    if (map.size < 2) continue;
    const entries = [...map.values()];
    if (new Set(entries.map(x => cityKey(x.ev.city))).size < 2) continue;
    const rank = x => eventTier(x.ev, isFestival(x.ev));
    entries.sort((a, b) => rank(a) - rank(b)
      || richness(b.ev) - richness(a.ev)
      || String(a.ev.id).localeCompare(String(b.ev.id)));
    const winner = entries[0].ev;
    const wc = cityKey(winner.city);
    out.push({
      djKey,
      dj: entries[0].dj,
      date: winner.date,
      winner,
      losers: entries.map(x => x.ev).filter(e => cityKey(e.city) !== wc),
    });
  }
  return out;
}

// ── Dedupe merge rules (steps/09-dedupe.js) ───────────────────────────────────────
/** Split a duplicate group (keeper first) into the keeper and the rows to delete. A row with the
 *  keeper's own id is never in `rest`: deleting it would delete the event that is kept. */
export function splitKeeper(group) {
  const [keeper, ...others] = group;
  return { keeper, rest: others.filter(r => r.id !== keeper.id) };
}

/** Date of a merged event. A festival master (festival-named row with no lineup, `masterIds`)
 *  keeps its own date: fragments never move it. Without a master, a merged festival takes the
 *  earliest date of the group (multi-day festival rows that are equal, not a master). */
export function mergedDate({ keeper, rest, masterIds = new Set(), isFestival = false }) {
  const master = [keeper, ...rest].find(e => masterIds.has(e.id));
  if (master) return master.date;
  let best = keeper.date;
  if (isFestival) for (const ev of rest) if (ev.date && ev.date < best) best = ev.date;
  return best;
}
