/**
 * SoundMyth – double-booking detection and the manual block list.
 *
 * Detection only (dedupe Pass 6). "Same DJ, two cities, same day" is recorded for review and
 * never acted on by the detector. Nothing here deletes or strips anything.
 *
 *  - Festival-like events are not conflicts at all: a Songkick festival appearance is dated
 *    with the festival's FIRST day, so a DJ playing day 1 of a festival and a club elsewhere
 *    that day is not an error. Multi-act lineups are festivals or shared bills, not single shows.
 *  - Otherwise a pair is `likely-error` (different countries) or `possible-double-header`
 *    (same country: often two real shows in one day).
 *  - A human decides which event is wrong and lists its source_id in data/events_block.json.
 *    validate (step 12) deletes listed events on every run, after the weekly scrape re-adds them.
 */

import { existsSync, readFileSync } from 'fs';
import { cityKey, djMatchKey, eventTier } from './normalize.js';
import { makeFestivalNameTest } from './genres.js';

export const CATEGORY = Object.freeze({
  LIKELY_ERROR: 'likely-error',
  DOUBLE_HEADER: 'possible-double-header',
});
const CATEGORY_ORDER = [CATEGORY.LIKELY_ERROR, CATEGORY.DOUBLE_HEADER];

/** The fields a reviewer needs, as written to data/conflicts.json and quoted in the report. */
export function summarizeEvent(ev) {
  return {
    id: ev.id, source_id: ev.source_id, name: ev.name, venue: ev.venue || '', city: ev.city || '',
    country: ev.country || '', date: ev.date, source: ev.source, ticket_url: ev.ticket_url || '',
  };
}

/** Festival-like: an event that is not a single DJ at a single venue. Any one signal is enough. */
export function isFestivalLike(ev, isFestivalNamed = makeFestivalNameTest([])) {
  if (/songkick\.com\/festivals\//i.test(ev.ticket_url || '')) return true;   // Songkick festival-start dating
  if ((ev.tags || []).includes('festival')) return true;
  if (ev._festival || /^(sk_fest_|bit_fest_)/.test(ev.source_id || '')) return true;
  if (isFestivalNamed(ev)) return true;                                       // FEST_WORD or curated name
  if ((ev.djs || []).length > 1) return true;                                 // multi-act lineup
  return false;
}

/**
 * Pass 6 detector (pure, no writes). Groups events by (DJ, date). Every pair of events in
 * different cities is either ignored (festival-like on either side, counted in `ignoredFestival`)
 * or recorded as a conflict with a category. Returns
 * { pairs: [{ category, dj, date, a, b }], ignoredFestival }, likely errors first.
 */
export function detectConflicts(events, { festNames = [] } = {}) {
  const isFestivalNamed = makeFestivalNameTest(festNames);
  const festivalLike = new Map();
  const isFest = ev => {
    if (!festivalLike.has(ev.id)) festivalLike.set(ev.id, isFestivalLike(ev, isFestivalNamed));
    return festivalLike.get(ev.id);
  };

  const byDjDate = new Map();
  for (const ev of events) {
    if (!cityKey(ev.city) || !ev.date) continue;
    for (const dj of ev.djs || []) {
      const dk = djMatchKey(dj);
      if (!dk) continue;
      const k = `${dk}|${ev.date}`;
      if (!byDjDate.has(k)) byDjDate.set(k, { dj, date: ev.date, evs: new Map() });
      const g = byDjDate.get(k);
      if (!g.evs.has(ev.id)) g.evs.set(ev.id, ev);
    }
  }

  let ignoredFestival = 0;
  const pairs = [];
  for (const g of byDjDate.values()) {
    const evs = [...g.evs.values()];
    for (let i = 0; i < evs.length; i++) {
      for (let j = i + 1; j < evs.length; j++) {
        const x = evs[i], y = evs[j];
        if (cityKey(x.city) === cityKey(y.city)) continue;
        if (isFest(x) || isFest(y)) { ignoredFestival++; continue; }
        // Official / RA listing first, then the lower id: a stable reading order for the reviewer.
        const [a, b] = [x, y].sort((p, q) => eventTier(p) - eventTier(q) || String(p.id).localeCompare(String(q.id)));
        const cx = (a.country || '').trim().toLowerCase(), cy = (b.country || '').trim().toLowerCase();
        const category = cx && cy && cx !== cy ? CATEGORY.LIKELY_ERROR : CATEGORY.DOUBLE_HEADER;
        pairs.push({ category, dj: g.dj, date: g.date, a: summarizeEvent(a), b: summarizeEvent(b) });
      }
    }
  }

  pairs.sort((p, q) => CATEGORY_ORDER.indexOf(p.category) - CATEGORY_ORDER.indexOf(q.category)
    || p.date.localeCompare(q.date)
    || p.dj.localeCompare(q.dj)
    || String(p.a.id).localeCompare(String(q.a.id)));
  return { pairs, ignoredFestival };
}

/** Parse data/events_block.json. Throws on a malformed file: a block list that is silently
 *  ignored would let the events the user meant to remove come back unnoticed. */
export function parseBlockList(raw) {
  if (!Array.isArray(raw)) throw new Error('events_block.json must be a JSON array');
  return raw.map((e, i) => {
    if (!e || typeof e !== 'object' || typeof e.source_id !== 'string' || !e.source_id.trim()) {
      throw new Error(`events_block.json entry ${i}: source_id must be a non-empty string`);
    }
    return { source_id: e.source_id.trim(), reason: String(e.reason || ''), added: String(e.added || '') };
  });
}

/** Read the block list from disk. A missing file means an empty list. */
export function readBlockList(path) {
  if (!existsSync(path)) return [];
  return parseBlockList(JSON.parse(readFileSync(path, 'utf8')));
}

/** The events whose source_id is on the block list (pure). */
export function blockedEvents(events, entries) {
  const ids = new Set(entries.map(e => e.source_id));
  return events.filter(ev => ids.has(ev.source_id));
}
