// Songkick namesake detection (lib/namesake.js): signals, rules, the allow list, and the
// measured audit in test/fixtures/namesake-audit-2026-10.json. The audit is the evidence that
// AUTO_DROP_RULES is empty: a rule may only drop once it measures >= PRECISION_THRESHOLD here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import {
  norm, isSingleTokenName, isNonElectronicVenue, buildNamesakeContext, signalsFor,
  isNamesakeCandidate, findNamesakes, measureRule, parseAllowList, readAllowList,
  AUTO_DROP_RULES, RULES, REVIEW_RULE, PRECISION_THRESHOLD, REVIEW_CAP,
} from '../lib/namesake.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const audit = JSON.parse(readFileSync(resolve(__dirname, 'fixtures/namesake-audit-2026-10.json'), 'utf8'));

const ev = (id, dj, venue, extra = {}) => ({
  id, source: 'songkick', source_id: `sk_${id}`, djs: [dj], venue, city: 'X', country: 'Germany', date: '2026-11-01', ...extra,
});
const artists = [{ name: 'Luciano' }, { name: 'Rossi.' }, { name: 'Kanine' }, { name: 'Dan Ghenacia' }, { name: 'Carl Cox' }];

test('norm folds accents, ampersands and punctuation', () => {
  assert.equal(norm('Rossi.'), 'rossi');
  assert.equal(norm('Klüngelpütz Kabarett &theater'), 'klungelputz kabarett and theater');
  assert.equal(norm(null), '');
});

test('isSingleTokenName: one word of at most seven letters', () => {
  assert.equal(isSingleTokenName('Luciano'), true);
  assert.equal(isSingleTokenName('Rossi.'), true);
  assert.equal(isSingleTokenName('Afrojack'), false);     // 8 letters
  assert.equal(isSingleTokenName('Carl Cox'), false);     // two words
  assert.equal(isSingleTokenName(''), false);
});

test('isNonElectronicVenue catches the founder cases and not the club nights they resemble', () => {
  assert.equal(isNonElectronicVenue('Klüngelpütz Kabarett &theater'), true);
  assert.equal(isNonElectronicVenue('Kulturzentrum Pavillon'), true);
  assert.equal(isNonElectronicVenue('Werribee Plaza Tavern, Level 1 Upstairs'), true);
  assert.equal(isNonElectronicVenue('Martinikirche Buer'), true);
  assert.equal(isNonElectronicVenue('Monumental Plaza de Toros México'), false);
  assert.equal(isNonElectronicVenue('Omnia Nightclub'), false);
  assert.equal(isNonElectronicVenue('Drumsheds'), false);
});

test('signalsFor: venue_orphan needs no other known DJ at the venue and a non-club venue', () => {
  const events = [
    ev(1, 'Luciano', 'Die Glocke'),                         // only Luciano here
    ev(2, 'Luciano', 'Berghain'),
    ev(3, 'Carl Cox', 'Berghain'),                          // another known DJ plays Berghain
    ev(4, 'Kanine', 'Club Wiesbaden', { djs: ['Kanine', 'Someone Unknown'] }),  // lineup: not a candidate
  ];
  const ctx = buildNamesakeContext({ events, artists, clubs: [{ name: 'Berghain' }] });
  assert.equal(signalsFor(events[0], ctx).venue_orphan, true);
  assert.equal(signalsFor(events[1], ctx).venue_orphan, false, 'club venues are never orphans');
  assert.equal(signalsFor(events[2], ctx).venue_orphan, false);
  assert.equal(isNamesakeCandidate(events[3], ctx), false, 'multi-act lineups are out of scope');
});

test('signalsFor: a venue hosting another known DJ is not an orphan even if the name is generic', () => {
  const events = [ev(1, 'Rossi.', 'Hangar 7'), ev(2, 'Carl Cox', 'Hangar 7')];
  const ctx = buildNamesakeContext({ events, artists });
  assert.equal(signalsFor(events[0], ctx).venue_orphan, false);
  assert.equal(signalsFor(events[0], ctx).single_token_name, true);
});

test('same-day and next-day signals look at the same DJ in another country', () => {
  const events = [
    ev(1, 'Kanine', 'L Empreinte', { country: 'France', date: '2026-11-07' }),
    ev(2, 'Kanine', 'Drumsheds', { country: 'United Kingdom', date: '2026-11-07' }),
    ev(3, 'Carl Cox', 'Quarters', { country: 'United Kingdom', date: '2026-11-08' }),
  ];
  const ctx = buildNamesakeContext({ events, artists });
  const s = signalsFor(events[0], ctx);
  assert.equal(s.same_day_other_country, true);
  assert.equal(s.next_day_other_country, false);
  const s3 = signalsFor(events[2], ctx);
  assert.equal(s3.same_day_other_country, false);
});

test('findNamesakes: review holds orphan + (non-electronic venue or one-word name); allow list rescues', () => {
  const events = [
    ev(1, 'Luciano', 'Kulturzentrum Kreuzkirche', { source_id: 'sk_1' }),   // review (both)
    ev(2, 'Carl Cox', 'Hangar 7', { source_id: 'sk_2' }),                    // no signal
    ev(3, 'Kanine', 'Oddball Venue', { source_id: 'sk_3' }),                 // review (single token)
    ev(4, 'Carl Cox', 'Lost Club', { source_id: 'sk_4', source: 'bandsintown' }),  // not Songkick
  ];
  const ctx = buildNamesakeContext({ events, artists });
  const { drop, review } = findNamesakes(events, ctx);
  assert.deepEqual(drop, []);
  // Most suspicious first: Luciano at a non-club venue with a one-word name (score 3) before Kanine (score 1).
  assert.deepEqual(review.map(r => r.ev.source_id), ['sk_1', 'sk_3']);
  assert.deepEqual(review.map(r => r.score), [3, 1]);
  assert.ok(review[0].reasons.length >= 2);

  const allowed = findNamesakes(events, ctx, { allowIds: new Set(['sk_1']) });
  assert.deepEqual(allowed.review.map(r => r.ev.source_id), ['sk_3'], 'an allow-listed event is never flagged');
});

test('findNamesakes: only a rule listed in AUTO_DROP_RULES can drop, and a drop never also appears in review', () => {
  const events = [ev(1, 'Luciano', 'Kulturzentrum Kreuzkirche', { source_id: 'sk_1' })];
  const ctx = buildNamesakeContext({ events, artists });
  const { drop, review } = findNamesakes(events, ctx, { rules: ['venue_orphan_and_non_electronic_venue'] });
  assert.deepEqual(drop.map(d => d.ev.source_id), ['sk_1']);
  assert.deepEqual(review, [], 'a dropped event is not also listed for review');
  assert.deepEqual(findNamesakes(events, ctx).drop, [], 'the production policy drops nothing');
  assert.throws(() => findNamesakes(events, ctx, { rules: ['no_such_rule'] }), /unknown drop rule/);
});

test('the production policy is review-only until a rule is measured at or above the threshold', () => {
  assert.deepEqual([...AUTO_DROP_RULES], [], 'no rule may drop without the audit showing >= 95%');
  assert.equal(REVIEW_RULE, 'review');
  assert.equal(PRECISION_THRESHOLD, 0.95);
  assert.equal(REVIEW_CAP, 15);
});

test('measureRule: precision uses decided rows only, recall counts all namesakes', () => {
  const rows = [
    { signals: { venue_orphan: true, non_electronic_venue: true, single_token_name: false }, verdict: 'namesake' },
    { signals: { venue_orphan: true, non_electronic_venue: true, single_token_name: false }, verdict: 'correct' },
    { signals: { venue_orphan: true, non_electronic_venue: true, single_token_name: false }, verdict: 'unknown' },
    { signals: { venue_orphan: false, non_electronic_venue: false, single_token_name: false }, verdict: 'namesake' },
  ];
  const m = measureRule(rows, 'venue_orphan_and_non_electronic_venue');
  assert.equal(m.flagged, 3);
  assert.equal(m.precision, 0.5);
  assert.equal(m.recall, 0.5);
  assert.equal(m.unknown, 1);
  assert.throws(() => measureRule(rows, 'nope'), /unknown rule/);
});

test('parseAllowList accepts entries and rejects malformed files', () => {
  assert.deepEqual(parseAllowList([{ source_id: ' sk_9 ', reason: 'Luciano Berlin, not the rapper' }]), [
    { source_id: 'sk_9', reason: 'Luciano Berlin, not the rapper', added: '' },
  ]);
  assert.deepEqual(parseAllowList([]), []);
  assert.throws(() => parseAllowList({ source_id: 'sk_1' }), /must be a JSON array/);
  assert.throws(() => parseAllowList([{ reason: 'no id' }]), /source_id must be a non-empty string/);
  assert.throws(() => parseAllowList([null]), /entry 0/);
});

test('readAllowList: missing file is empty; bad file throws', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sm-allow-'));
  assert.deepEqual(readAllowList(join(dir, 'missing.json')), []);
  const bad = join(dir, 'bad.json');
  writeFileSync(bad, '[{"source_id": 3}]');
  assert.throws(() => readAllowList(bad), /source_id must be a non-empty string/);
});

test('the shipped events_allow.json parses (data invariant)', () => {
  assert.ok(Array.isArray(readAllowList(resolve(__dirname, '../data/events_allow.json'))));
});

// ── Audit fixture: the evidence behind the policy ─────────────────────────────

test('audit fixture: every decided row carries an evidence URL and only decided rows do', () => {
  for (const r of audit.rows) {
    if (r.verdict === 'unknown') assert.equal(r.evidence, '', `${r.source_id} unknown but has evidence`);
    else assert.match(r.evidence, /^https?:\/\//, `${r.source_id} decided without evidence URL`);
  }
  assert.equal(audit.rows.length, 110);
});

test('audit fixture: text signals match the helper (so a reviewer can recompute them)', () => {
  for (const r of audit.rows) {
    assert.equal(isNonElectronicVenue(r.venue), r.signals.non_electronic_venue, `keyword mismatch: ${r.venue}`);
    assert.equal(isSingleTokenName(r.dj), r.signals.single_token_name, `token mismatch: ${r.dj}`);
  }
});

test('audit fixture: the review rule is measured as recorded (24 flagged, 6 namesake, 7 correct)', () => {
  const m = measureRule(audit.rows, REVIEW_RULE);
  assert.equal(m.flagged, 24);
  assert.equal(m.namesake, 6);
  assert.equal(m.correct, 7);
  assert.equal(m.namesakesInSample, 7);
  assert.ok(m.precision < PRECISION_THRESHOLD, 'the review rule must not be promoted to a drop on this evidence');
});

test('audit fixture: every auto-drop rule meets the threshold on the audit', () => {
  for (const rule of AUTO_DROP_RULES) {
    const m = measureRule(audit.rows, rule);
    assert.ok(m.precision !== null && m.precision >= PRECISION_THRESHOLD, `${rule} precision ${m.precision}`);
  }
});

test('audit fixture: every named rule is measurable (the table in docs/OPERATIONS.md can be regenerated)', () => {
  for (const rule of Object.keys(RULES)) {
    const m = measureRule(audit.rows, rule);
    assert.equal(typeof m.flagged, 'number');
  }
});
