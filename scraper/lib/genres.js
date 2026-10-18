/**
 * SoundMyth – canonical music-style taxonomy + event genre/tag rules.
 *
 * Pure functions, no I/O. Shared by steps/13-classify.js (pipeline step), tools/infer-styles.js and
 * the artists artifact. Spec: pre-launch overhaul contract §1–§4.
 *
 *  - STYLES: the 16 canonical styles. Every DJ `genre` and every event `genre` is one of
 *    these, except the single fallback FALLBACK_GENRE ('Multi-genre'), which is used ONLY
 *    for events/festivals whose lineup has no known DJ.
 *  - canonGenre(raw, subgenre?): any legacy / variant label → canonical style, or
 *    FALLBACK_GENRE for the generic labels (Electronic, Pop…), or null when unknown.
 *  - djKey(name): the one DJ key used everywhere (frontend + backend).
 *  - eventGenre(djs, artists, festivalStyle): the most frequent canonical genre among the
 *    lineup DJs; tie → genre of the highest-ranked DJ in the tie, then lineup order.
 *  - eventTags(djs, artists, type): [type?] + at most 3 vibe tags from VIBES.
 */

import { normText } from './normalize.js';

export const STYLES = Object.freeze([
  'House', 'Tech House', 'Deep House', 'Afro House', 'Melodic Techno', 'Techno',
  'Hard Techno', 'Trance', 'Psytrance', 'Progressive', 'Big Room', 'Bass',
  'Drum & Bass', 'Hardstyle', 'Indie Dance', 'Electro',
]);
export const FALLBACK_GENRE = 'Multi-genre';

/** Vibe whitelist (the only tags allowed on DJs and events, besides the type tag). */
export const VIBES = Object.freeze([
  'melodic', 'dark', 'hard', 'underground', 'mainstream', 'vocal', 'atmospheric',
  'experimental', 'classic', 'disco', 'emotional', 'psychedelic', 'latin', 'afro',
]);
const VIBE_SET = new Set(VIBES);
const MAX_VIBES = 3;

// Legacy / variant labels → canonical (keys lowercased; see canonGenre).
const LEGACY = {
  'big room / festival edm': 'Big Room',
  'big room': 'Big Room',
  'electro house': 'Big Room',
  'bass music': 'Bass',
  'bass music / dubstep': 'Bass',
  'dubstep': 'Bass',
  'trap': 'Bass',
  'indie dance / leftfield': 'Indie Dance',
  'drum & bass / breaks': 'Drum & Bass',
  'drum and bass': 'Drum & Bass',
  'dnb': 'Drum & Bass',
  'progressive house': 'Progressive',
  'hard dance': 'Hardstyle',
  'hardcore': 'Hardstyle',
  'acid house': 'House',
  'future house': 'House',
  'tropical house': 'House',
  'melodic house': 'Melodic Techno',
  'melodic house & techno': 'Melodic Techno',
  'psy trance': 'Psytrance',
  'electronic': FALLBACK_GENRE,
  'edm': FALLBACK_GENRE,
  'pop': FALLBACK_GENRE,
  'pop electronic / crossover': FALLBACK_GENRE,
  'multi-genre': FALLBACK_GENRE,
};

// Subgenre → canonical style. Used to refine a DJ's coarse genre (the curated list has
// e.g. genre "House" + subgenre "Tech House"). Only subgenres that clearly map are listed;
// anything else falls back to the genre label.
const SUBGENRE = {
  'tech house': 'Tech House',
  'peak time techno': 'Techno', 'techno': 'Techno', 'industrial techno': 'Techno',
  'minimal techno': 'Techno', 'acid techno': 'Techno', 'dub techno': 'Techno',
  'hard techno': 'Hard Techno', 'rawstyle': 'Hardstyle',
  'melodic techno': 'Melodic Techno', 'melodic house': 'Melodic Techno', 'melodic house & techno': 'Melodic Techno',
  'deep house': 'Deep House', 'organic house': 'Deep House',
  'afro house': 'Afro House',
  'progressive house': 'Progressive', 'progressive': 'Progressive',
  'festival progressive': 'Big Room', 'big room house': 'Big Room', 'big room techno': 'Big Room',
  'big room': 'Big Room', 'electro house': 'Big Room',
  'future house': 'House', 'bass house': 'House', 'house': 'House', 'slap house': 'House',
  'tropical house': 'House', 'piano house': 'House', 'uk garage': 'House',
  'uplifting trance': 'Trance', 'tech trance': 'Trance', 'progressive trance': 'Trance', 'trance': 'Trance',
  'psytrance': 'Psytrance', 'psy trance': 'Psytrance',
  'drum & bass': 'Drum & Bass', 'drum and bass': 'Drum & Bass', 'dnb': 'Drum & Bass',
  'liquid dnb': 'Drum & Bass', 'jungle': 'Drum & Bass',
  'dubstep': 'Bass', 'trap': 'Bass', 'future bass': 'Bass', 'melodic dubstep': 'Bass',
  'experimental bass': 'Bass', 'brazilian bass': 'Bass', 'riddim': 'Bass', 'breakbeat': 'Bass',
  'hardstyle': 'Hardstyle', 'hardcore': 'Hardstyle',
  'indie dance': 'Indie Dance', 'electronica': 'Indie Dance',
  'electro': 'Electro',
};

const CANON_BY_LOWER = new Map(STYLES.map(s => [s.toLowerCase(), s]));

/**
 * Canonical style for a raw genre label (and optional subgenre, which wins when it maps).
 * Returns one of STYLES, FALLBACK_GENRE for generic labels, or null when unknown/empty.
 */
export function canonGenre(raw, subgenre) {
  const sub = (subgenre || '').trim().toLowerCase();
  if (sub && SUBGENRE[sub]) return SUBGENRE[sub];
  const g = (raw || '').trim().toLowerCase();
  if (!g || g === 'unknown') return null;
  if (CANON_BY_LOWER.has(g)) return CANON_BY_LOWER.get(g);
  if (LEGACY[g]) return LEGACY[g];
  return null;
}

/** DJ-level style: a real style (never FALLBACK_GENRE, never null-as-string). */
export function djStyle(raw, subgenre) {
  const s = canonGenre(raw, subgenre);
  return s && s !== FALLBACK_GENRE ? s : null;
}

/** Exactly the DJ key from the contract §4 — use everywhere. */
export const djKey = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '');

// Vibe aliases from the legacy DJ tag vocabulary. Anything not listed and not in VIBES is dropped.
const VIBE_ALIAS = { commercial: 'mainstream' };

/**
 * Normalise a vibe list (array or comma-separated string) to the whitelist.
 * Source names, 'discovered', 'dj', 'UNKNOWN', genre names etc. are dropped.
 * If both 'underground' and 'mainstream' survive, both are dropped (contract §3).
 */
export function normVibes(input) {
  const list = Array.isArray(input) ? input : String(input || '').split(/[,;]/);
  const out = [];
  for (const raw of list) {
    const t = String(raw || '').trim().toLowerCase();
    const v = VIBE_ALIAS[t] || t;
    if (VIBE_SET.has(v) && !out.includes(v)) out.push(v);
  }
  if (out.includes('underground') && out.includes('mainstream')) {
    return out.filter(v => v !== 'underground' && v !== 'mainstream');
  }
  return out;
}

/**
 * Build the lookup used by eventGenre/eventTags from artists_all.json rows.
 * key → { name, genre, ranking, vibes }. Rows without a usable name are skipped.
 */
export function buildArtistsIndex(rows) {
  const idx = {};
  for (const a of rows || []) {
    const k = djKey(a.name);
    if (!k) continue;
    const ranking = Number(a.ranking);
    idx[k] = {
      name: a.name,
      genre: a.genre || '',
      ranking: Number.isFinite(ranking) ? ranking : Infinity,
      vibes: normVibes(a.vibes ?? a.tags),
    };
  }
  return idx;
}

/**
 * Event genre (contract §2).
 * djs: lineup names. artists: index from buildArtistsIndex. festivalStyle: optional
 * curated style of the festival (used only when no lineup DJ is known).
 */
export function eventGenre(djs, artists, festivalStyle) {
  const stats = new Map();   // style → { n, bestRank, bestIdx }
  (djs || []).forEach((name, i) => {
    const a = artists && artists[djKey(name)];
    if (!a) return;
    const g = djStyle(a.genre);
    if (!g) return;
    const s = stats.get(g) || { n: 0, bestRank: Infinity, bestIdx: Infinity };
    s.n += 1;
    if (a.ranking < s.bestRank || (a.ranking === s.bestRank && i < s.bestIdx)) {
      s.bestRank = a.ranking; s.bestIdx = i;
    }
    stats.set(g, s);
  });
  if (stats.size) {
    const ranked = [...stats.entries()].sort(([, x], [, y]) =>
      (y.n - x.n) || (x.bestRank - y.bestRank) || (x.bestIdx - y.bestIdx));
    return ranked[0][0];
  }
  return djStyle(festivalStyle) || FALLBACK_GENRE;
}

/**
 * Event tags (contract §3): [type?] + top ≤3 vibes by frequency across known lineup DJs.
 * type: 'festival' | 'club' | anything else (ignored). Never both underground and mainstream.
 */
export function eventTags(djs, artists, type) {
  const counts = new Map();   // vibe → { n, firstIdx }
  (djs || []).forEach((name, i) => {
    const a = artists && artists[djKey(name)];
    if (!a) return;
    for (const v of normVibes(a.vibes)) {
      const c = counts.get(v) || { n: 0, firstIdx: i };
      c.n += 1;
      counts.set(v, c);
    }
  });
  const nU = counts.get('underground')?.n || 0;
  const nM = counts.get('mainstream')?.n || 0;
  if (nU && nM) {
    if (nU > nM) counts.delete('mainstream');
    else if (nM > nU) counts.delete('underground');
    else { counts.delete('underground'); counts.delete('mainstream'); }
  }
  const vibes = [...counts.entries()]
    .sort(([, x], [, y]) => (y.n - x.n) || (x.firstIdx - y.firstIdx))
    .slice(0, MAX_VIBES).map(([v]) => v);
  const t = type === 'festival' || type === 'club' ? [type] : [];
  return [...t, ...vibes];
}

/** Legacy label → canonical, for old saved preferences / old data (exported for the app contract). */
export const LEGACY_MAP = Object.freeze({ ...LEGACY });

// ── Festival detection for classify (steps/13-classify.js) ─────────────────────────
// FEST_WORD: "festival", "fest", "open air", "weekender" as whole words in the name or venue.
const FEST_WORD = /\b(festival|fest|open ?air|weekender)\b/i;
/**
 * Predicate: is this event a festival? True on FEST_WORD, or when a curated festival name is
 * matched as whole words. A curated name only counts when it is two or more words ("EDC Thailand",
 * "Tomorrowland Belgium") or when the whole name or venue field IS the one-word name ("Exit").
 * A one-word name inside a longer title is not evidence: "Cambridge Junction" is a venue and
 * "Oasis Punta Carrasco" is a club. Names shorter than 5 characters are ignored.
 */
export function makeFestivalNameTest(festNames = []) {
  const phrases = [], singles = new Set();
  for (const n of festNames || []) {
    const k = normText(n);
    if (k.length < 5) continue;
    if (k.includes(" ")) phrases.push(" " + k + " "); else singles.add(k);
  }
  return ev => {
    if (FEST_WORD.test(ev?.name || "") || FEST_WORD.test(ev?.venue || "")) return true;
    const nf = normText(ev?.name), vf = normText(ev?.venue);
    if (singles.has(nf) || singles.has(vf)) return true;
    const nt = " " + nf + " ", vt = " " + vf + " ";
    return phrases.some(p => nt.includes(p) || vt.includes(p));
  };
}
