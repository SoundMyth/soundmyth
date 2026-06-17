import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonCity, cleanVenue, looksLikeBareArtist, djNorm, pickCanon, buildDjCanon } from '../normalize.js';

test('canonCity: explicit aliases win', () => {
  assert.equal(canonCity('Eivissa'), 'Ibiza');
  assert.equal(canonCity('Sant Jordi De Ses Salines'), 'Ibiza');
  assert.equal(canonCity('София'), 'Sofia');
  assert.equal(canonCity('İstanbul'), 'Istanbul');
  assert.equal(canonCity('福岡市'), 'Fukuoka');
});

test('canonCity: transliterates unmapped non-Latin, keeps Latin-1 accents', () => {
  assert.equal(canonCity('Αθήνα'), 'Athina');        // Greek, not aliased
  assert.equal(canonCity('Чебоксары'), 'Cheboksary'); // new Cyrillic city
  assert.equal(canonCity('Zürich'), 'Zürich');         // Latin-1 accent kept
  assert.equal(canonCity('Málaga'), 'Málaga');
  assert.equal(canonCity('Madrid'), 'Madrid');
});

test('canonCity: trims & collapses whitespace', () => {
  assert.equal(canonCity('  Madrid  '), 'Madrid');
  assert.equal(canonCity('New   York'), 'New York');
  assert.equal(canonCity(''), '');
  assert.equal(canonCity(null), '');
});

test('cleanVenue: drops a venue that just repeats the title', () => {
  assert.equal(cleanVenue('Tomorrowland and DVLM', 'Tomorrowland and DVLM'), '');
  assert.equal(cleanVenue('Hï Ibiza', 'Anyma'), 'Hï Ibiza');
  assert.equal(cleanVenue('', 'Anyma'), '');
  assert.equal(cleanVenue('  Pacha  ', 'Pacha'), '');  // trimmed-equal
});

test('looksLikeBareArtist: single act + no real venue', () => {
  assert.equal(looksLikeBareArtist({ name: 'X and DJ', venue: 'X and DJ', djs: ['DJ'] }), true);
  assert.equal(looksLikeBareArtist({ name: 'X', venue: '', djs: [] }), true);
  assert.equal(looksLikeBareArtist({ name: 'Fest', venue: 'Real Venue', djs: ['A'] }), false);
  assert.equal(looksLikeBareArtist({ name: 'Fest', venue: '', djs: ['A', 'B', 'C'] }), false);
});

test('djNorm: case + diacritic insensitive', () => {
  assert.equal(djNorm('ALOK'), djNorm('alok'));
  assert.equal(djNorm('Âme'), djNorm('AME'));
  assert.equal(djNorm('Rüfüs Du Sol'), djNorm('RÜFÜS DU SOL'));
});

test('pickCanon: prefers Title-case + diacritics over ALL CAPS', () => {
  assert.equal(pickCanon({ 'alok': 3, 'Alok': 1 }), 'Alok');
  assert.equal(pickCanon({ 'MEDUZA': 5, 'Meduza': 1 }), 'Meduza');
  assert.equal(pickCanon({ 'AME': 2, 'Âme': 1 }), 'Âme');
});

test('buildDjCanon: one canonical spelling per artist', () => {
  const rows = [
    { djs: ['alok', 'CHARLOTTE DE WITTE'] },
    { djs: ['Alok', 'Charlotte de Witte'] },
    { djs: ['Alok'] },
  ];
  const map = buildDjCanon(rows);
  assert.equal(map[djNorm('alok')], 'Alok');
  assert.equal(map[djNorm('charlotte de witte')], 'Charlotte de Witte');
});
