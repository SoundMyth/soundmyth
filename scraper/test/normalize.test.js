import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonCity, cleanVenue, looksLikeBareArtist, djNorm, pickCanon, buildDjCanon } from '../normalize.js';

test('canonCity: explicit aliases & exonyms win', () => {
  assert.equal(canonCity('Eivissa'), 'Ibiza');
  assert.equal(canonCity('Sant Jordi De Ses Salines'), 'Ibiza');
  assert.equal(canonCity('София'), 'Sofia');
  assert.equal(canonCity('İstanbul'), 'Istanbul');
  assert.equal(canonCity('福岡市'), 'Fukuoka');
  assert.equal(canonCity('München'), 'Munich');
  assert.equal(canonCity('Köln'), 'Cologne');
  assert.equal(canonCity('Lisboa'), 'Lisbon');
  assert.equal(canonCity('Milano'), 'Milan');
});

test('canonCity: folds accents/scripts to ASCII so variants merge', () => {
  assert.equal(canonCity('Málaga'), 'Malaga');
  assert.equal(canonCity('Malaga'), 'Malaga');
  assert.equal(canonCity('Montréal'), 'Montreal');
  assert.equal(canonCity('Zürich'), 'Zurich');
  assert.equal(canonCity('São Paulo'), 'Sao Paulo');
  assert.equal(canonCity('Bogotá'), 'Bogota');
  assert.equal(canonCity('Αθήνα'), 'Athina');   // Greek, unmapped → romanized
  assert.equal(canonCity('Madrid'), 'Madrid');
});

test('canonCity: trims & handles empty', () => {
  assert.equal(canonCity('  Madrid  '), 'Madrid');
  assert.equal(canonCity('New   York'), 'New York');
  assert.equal(canonCity(''), '');
  assert.equal(canonCity(null), '');
});

test('cleanVenue: drops a venue that just repeats the title', () => {
  assert.equal(cleanVenue('Tomorrowland and DVLM', 'Tomorrowland and DVLM'), '');
  assert.equal(cleanVenue('Hï Ibiza', 'Anyma'), 'Hï Ibiza');
  assert.equal(cleanVenue('', 'Anyma'), '');
  assert.equal(cleanVenue('  Pacha  ', 'Pacha'), '');
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
