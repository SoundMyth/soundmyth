// Festival edition naming for merged festival keepers (dedupe): festivalEditionName in lib/normalize.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { festivalEditionName } from '../lib/normalize.js';

const SCREAM_URL = 'https://www.songkick.com/festivals/916004-scream/id/43133962-scream-2026?utm_medium=organic&utm_source=microformat';
const scream = (over = {}) => ({
  name: 'Sara Landry @ Edmonton EXPO Centre (EEC)',
  venue: 'Edmonton EXPO Centre (EEC)',
  ticket_url: SCREAM_URL,
  ...over,
});

test('Scream Edmonton: a merged per-artist row takes the festival edition name, from the edition slug', () => {
  assert.equal(festivalEditionName(scream(), 3), 'Scream 2026');
});

test('a curated festivals_all.json name wins when the slug matches it', () => {
  const url = 'https://www.songkick.com/festivals/1-edc/id/2-edc-thailand-2026';
  assert.equal(festivalEditionName({ name: 'Alok @ Impact Arena', ticket_url: url }, 2, ['EDC Thailand 2026', 'Other']), 'EDC Thailand 2026');
  // Without a matching curated name, the slug-derived name is used.
  assert.equal(festivalEditionName({ name: 'Alok @ Impact Arena', ticket_url: url }, 2, ['Other']), 'Edc Thailand 2026');
});

test('garbage slugs: tracking params, bare ids, and non-word junk never produce a name', () => {
  const at = slug => `https://www.songkick.com/festivals/1-x/id/2-${slug}`;
  assert.equal(festivalEditionName({ name: 'A @ V', ticket_url: at('utm-medium-organic') }, 2), null);
  assert.equal(festivalEditionName({ name: 'A @ V', ticket_url: at('43133962') }, 2), null);
  assert.equal(festivalEditionName({ name: 'A @ V', ticket_url: at('%E2%80%A6') }, 2), null);
  assert.equal(festivalEditionName({ name: 'A @ V', ticket_url: at('%FF%FE') }, 2), null);
});

test('a junk tail after the name is cut at the first non-word token', () => {
  const url = 'https://www.songkick.com/festivals/1-scream/id/2-scream-2026-43133962-extra';
  assert.equal(festivalEditionName({ name: 'A @ V', ticket_url: url }, 2), 'Scream 2026');
});

test('does not apply: single DJ, not a fragment name, not a Songkick festival URL, or no URL', () => {
  assert.equal(festivalEditionName(scream(), 1), null, 'one DJ is not a merged festival');
  assert.equal(festivalEditionName(scream({ name: 'Scream 2026' }), 3), null, 'already an edition name');
  assert.equal(festivalEditionName(scream({ ticket_url: 'https://www.songkick.com/concerts/43-alok' }), 3), null);
  assert.equal(festivalEditionName(scream({ ticket_url: '' }), 3), null);
  assert.equal(festivalEditionName(scream({ ticket_url: null }), 3), null);
});

test('the venue is never part of the returned name (the caller keeps the venue field)', () => {
  const out = festivalEditionName(scream(), 3);
  assert.ok(!out.includes('Edmonton'));
});
