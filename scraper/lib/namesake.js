/**
 * SoundMyth – Songkick "namesake" detection (pure helpers, no I/O except readAllowList).
 *
 * Songkick merges every act with the same name into one artist page, so a DJ's calendar can
 * hold another act's gigs: "Luciano" the German rapper and Pavarotti tributes, "Kanine" at a
 * rock club, "Afrojack" at an Australian tavern. This module scores each single-DJ Songkick
 * event on five signals and applies two policies:
 *
 *  - AUTO_DROP_RULES: rules precise enough to delete (>= PRECISION_THRESHOLD on the audit).
 *    EMPTY on purpose: no measured rule reached 95% (test/fixtures/namesake-audit-2026-10.json,
 *    docs/OPERATIONS.md "Namesakes"). A rule is promoted only by adding it here AND re-measuring.
 *  - REVIEW_RULE: listed in the weekly email as "Suspected namesakes (review)". Never deletes.
 *
 * A source_id in data/events_allow.json is never flagged and never dropped (the rescue list).
 * Blocking a namesake by hand is the existing data/events_block.json (step 12).
 *
 * Population: Songkick events with exactly one listed performer, whose performer is a known DJ
 * (artists_all.json, or an RA-verified candidate). Lineups and festivals are out of scope.
 */

import { existsSync, readFileSync } from 'fs';

export const PRECISION_THRESHOLD = 0.95;
export const REVIEW_CAP = 15;

/** Fold to lowercase ASCII words: NFD, drop marks, "&" becomes "and", punctuation becomes spaces. */
export function norm(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Venue words that rarely host electronic music. Several also hit real club nights
 *  ("The Church Nightclub", "Opera House", "Hotel Arena"), so this is a review signal only. */
// German compounds ("Martinikirche", "Kulturzentrum") match without a left word boundary.
const NON_ELECTRONIC_VENUE = new RegExp([
  '\\b(?:kabarett|cabaret|church|cathedral|chapel|tavern|pub|opera|philharmonie|bowling|library|museum|university|universidad|school|hotel|casino|teatro|auditorium|concert hall|rathaus|kultur|oper)\\b',
  '(?:kirche|kathedrale|kapelle|kulturzentrum|kulturhaus|kulturhalle|schauspielhaus|stadthalle|festspielhaus|gemeindehaus|bibliothek|schule|brauerei|konzerthaus|brewery)\\b',
].join('|'));

/** One word of at most seven letters: "Rossi.", "Kanine", "Script", "Luciano". Generic names collide most. */
export function isSingleTokenName(name) {
  const n = norm(name);
  return n.length > 0 && !n.includes(' ') && n.length <= 7;
}

export function isNonElectronicVenue(venue) {
  return NON_ELECTRONIC_VENUE.test(norm(venue));
}

/**
 * Context shared by every event in one run. `events` must be the full future event list
 * (all sources), so "does this venue host another DJ we know" sees the whole database.
 */
export function buildNamesakeContext({ events = [], artists = [], candidates = [], clubs = [] }) {
  const known = new Set();
  for (const a of artists) known.add(norm(a.name));
  for (const c of candidates) if (c && c.onRA) known.add(norm(c.name));
  known.delete('');

  const clubKeys = new Set(clubs.map(c => norm(c.name)).filter(Boolean));

  const venueDjs = new Map();   // venue key -> Set of known DJ keys playing it
  const byDj = new Map();       // DJ key -> [{ id, date, country }] for same-day / next-day checks
  for (const ev of events) {
    const vk = norm(ev.venue);
    for (const d of ev.djs || []) {
      const dk = norm(d);
      if (!known.has(dk)) continue;
      if (!venueDjs.has(vk)) venueDjs.set(vk, new Set());
      venueDjs.get(vk).add(dk);
    }
    const first = norm((ev.djs || [])[0]);
    if (first) {
      if (!byDj.has(first)) byDj.set(first, []);
      byDj.get(first).push({ id: ev.id, date: ev.date, country: String(ev.country || '').trim().toLowerCase() });
    }
  }
  return { known, clubKeys, venueDjs, byDj };
}

/** Only these events are scored at all. */
export function isNamesakeCandidate(ev, ctx) {
  if (ev.source !== 'songkick') return false;
  if (!Array.isArray(ev.djs) || ev.djs.length !== 1) return false;
  return ctx.known.has(norm(ev.djs[0]));
}

/** The five signals for one event. Pure given the context. */
export function signalsFor(ev, ctx) {
  const dk = norm(ev.djs[0]);
  const vk = norm(ev.venue);
  const club = ctx.clubKeys.has(vk);
  const otherDjs = [...(ctx.venueDjs.get(vk) || [])].filter(k => k !== dk);
  const country = String(ev.country || '').trim().toLowerCase();
  const others = (ctx.byDj.get(dk) || []).filter(o => o.id !== ev.id && o.country && country && o.country !== country);
  return {
    venue_orphan: otherDjs.length === 0 && !club,                        // no other known DJ plays here
    non_electronic_venue: isNonElectronicVenue(ev.venue),
    single_token_name: isSingleTokenName(ev.djs[0]),
    same_day_other_country: others.some(o => o.date === ev.date),         // same DJ, same day, other country
    next_day_other_country: others.some(o => Math.abs(Date.parse(o.date) - Date.parse(ev.date)) === 86400000),
    club,                                                                 // venue is in clubs_all.json
  };
}

/** Named rules over signal objects. Keys are what data/ and the fixture refer to. */
export const RULES = Object.freeze({
  venue_orphan_and_non_electronic_venue: s => s.venue_orphan && s.non_electronic_venue,
  venue_orphan_and_single_token_name: s => s.venue_orphan && s.single_token_name,
  same_day_other_country: s => s.same_day_other_country,
  next_day_other_country: s => s.next_day_other_country,
  // The review section: venue no other known DJ plays, and either a non-electronic venue word or a generic name.
  review: s => s.venue_orphan && (s.non_electronic_venue || s.single_token_name),
});

/** Rules allowed to DELETE. Empty: none reached PRECISION_THRESHOLD on the 2026-10 audit. */
export const AUTO_DROP_RULES = Object.freeze([]);
export const REVIEW_RULE = 'review';

/** Reasons a reviewer can read, in plain words. */
export function reasonsFor(s) {
  const out = [];
  if (s.venue_orphan) out.push('no other known DJ plays this venue');
  if (s.non_electronic_venue) out.push('venue name suggests a non-club (church, cabaret, hotel, museum...)');
  if (s.single_token_name) out.push('one-word name (common-name collision risk)');
  if (s.same_day_other_country) out.push('same DJ listed in another country the same day');
  if (s.next_day_other_country) out.push('same DJ listed in another country the next day');
  return out;
}

/**
 * Pure measurement over labelled rows: { signals, verdict } with verdict in
 * 'namesake' | 'correct' | 'unknown'. Precision = namesakes / (namesakes + correct) over the
 * rows the rule flags; 'unknown' rows are excluded from the precision denominator and counted.
 */
export function measureRule(rows, rule) {
  const test = RULES[rule];
  if (!test) throw new Error(`unknown rule: ${rule}`);
  let flagged = 0, namesake = 0, correct = 0, unknown = 0;
  let totalNamesake = 0, caught = 0;
  for (const r of rows) {
    const hit = test(r.signals);
    if (r.verdict === 'namesake') { totalNamesake++; if (hit) caught++; }
    if (!hit) continue;
    flagged++;
    if (r.verdict === 'namesake') namesake++;
    else if (r.verdict === 'correct') correct++;
    else unknown++;
  }
  const decided = namesake + correct;
  return {
    rule, flagged, namesake, correct, unknown,
    precision: decided ? namesake / decided : null,
    recall: totalNamesake ? caught / totalNamesake : null,
    namesakesInSample: totalNamesake,
  };
}

/** Parse data/events_allow.json. A malformed list throws: a silently ignored rescue list
 *  would bring a rescued event back into the email (and, later, into a drop). */
export function parseAllowList(raw) {
  if (!Array.isArray(raw)) throw new Error('events_allow.json must be a JSON array');
  return raw.map((e, i) => {
    if (!e || typeof e !== 'object' || typeof e.source_id !== 'string' || !e.source_id.trim()) {
      throw new Error(`events_allow.json entry ${i}: source_id must be a non-empty string`);
    }
    return { source_id: e.source_id.trim(), reason: String(e.reason || ''), added: String(e.added || '') };
  });
}

/** Read the allow list from disk. A missing file means an empty list. */
export function readAllowList(path) {
  if (!existsSync(path)) return [];
  return parseAllowList(JSON.parse(readFileSync(path, 'utf8')));
}

/** Ordering for the review list, so the capped email shows the most suspicious first. Not a probability. */
export function suspicion(s) {
  return (s.non_electronic_venue ? 2 : 0) + (s.same_day_other_country ? 2 : 0)
    + (s.single_token_name ? 1 : 0) + (s.next_day_other_country ? 1 : 0);
}

/**
 * Select namesakes from a future-event list (pure).
 * Returns { drop: [{ ev, rule, signals }], review: [{ ev, signals, reasons }] } with review sorted
 * by date. `drop` only holds events matched by an AUTO_DROP_RULES rule; `review` never overlaps it.
 * Allow-listed source_ids are skipped entirely.
 */
export function findNamesakes(events, ctx, { allowIds = new Set(), rules = AUTO_DROP_RULES } = {}) {
  for (const r of rules) if (!RULES[r]) throw new Error(`unknown drop rule: ${r}`);
  const drop = [], review = [];
  for (const ev of events) {
    if (allowIds.has(ev.source_id)) continue;
    if (!isNamesakeCandidate(ev, ctx)) continue;
    const signals = signalsFor(ev, ctx);
    const rule = rules.find(r => RULES[r](signals));
    if (rule) { drop.push({ ev, rule, signals }); continue; }
    if (RULES[REVIEW_RULE](signals)) review.push({ ev, signals, score: suspicion(signals), reasons: reasonsFor(signals) });
  }
  const byDate = (a, b) => String(a.ev.date).localeCompare(String(b.ev.date))
    || String(a.ev.djs[0]).localeCompare(String(b.ev.djs[0]))
    || String(a.ev.venue || '').localeCompare(String(b.ev.venue || ''));
  review.sort((a, b) => b.score - a.score || byDate(a, b));
  drop.sort(byDate);
  return { drop, review };
}
