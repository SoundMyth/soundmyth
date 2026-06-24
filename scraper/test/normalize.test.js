import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonCity, canonCountry, canonStyle, cleanVenue, looksLikeBareArtist, djNorm, pickCanon, buildDjCanon } from '../normalize.js';

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

test('canonCity: Title-cases so caps/hyphen-case variants merge', () => {
  assert.equal(canonCity('BOCHUM'), 'Bochum');
  assert.equal(canonCity('Bochum'), 'Bochum');
  assert.equal(canonCity('rio de janeiro'), 'Rio De Janeiro');
  assert.equal(canonCity('Rio De Janeiro'), 'Rio De Janeiro');
  assert.equal(canonCity('Cluj-napoca'), 'Cluj-Napoca');
  assert.equal(canonCity('Cluj-Napoca'), 'Cluj-Napoca');
});

test('canonCity: drops uppercase nickname acronyms, keeps lowercase disambiguators', () => {
  assert.equal(canonCity('New York (NYC)'), 'New York');
  assert.equal(canonCity('Los Angeles (LA)'), 'Los Angeles');
  assert.equal(canonCity('Frankfurt (oder)'), 'Frankfurt (oder)');   // real, distinct city — kept
});

test('canonCity: trims & handles empty', () => {
  assert.equal(canonCity('  Madrid  '), 'Madrid');
  assert.equal(canonCity('New   York'), 'New York');
  assert.equal(canonCity(''), '');
  assert.equal(canonCity(null), '');
});

test('canonCountry: folds long-form variants to one canonical name', () => {
  assert.equal(canonCountry('United States of America'), 'United States');
  assert.equal(canonCountry('USA'), 'United States');
  assert.equal(canonCountry('US'), 'United States');
  assert.equal(canonCountry('UK'), 'United Kingdom');
  assert.equal(canonCountry('Czech Republic'), 'Czechia');
  assert.equal(canonCountry('Korea, Republic Of'), 'South Korea');
  assert.equal(canonCountry('United States'), 'United States');   // already canonical
  assert.equal(canonCountry('Spain'), 'Spain');                   // untouched
  assert.equal(canonCountry(''), '');
  assert.equal(canonCountry(null), '');
});

test('canonStyle: folds verbose genre/subgenre into clean buckets (idempotent)', () => {
  assert.equal(canonStyle('Big Room / Festival EDM', ''), 'Big Room');
  assert.equal(canonStyle('Pop Electronic / Crossover', ''), 'Pop');
  assert.equal(canonStyle('House', 'Tech House'), 'Tech House');   // subgenre wins
  assert.equal(canonStyle('Techno', 'Hard Techno'), 'Hard Techno');
  assert.equal(canonStyle('Big Room', ''), 'Big Room');            // already clean → itself
  assert.equal(canonStyle('Tech House', ''), 'Tech House');        // idempotent
  assert.equal(canonStyle('Electronic', ''), 'Electronic');
  assert.equal(canonStyle('Garage', ''), 'Electronic');            // unknown → fallback
  assert.equal(canonStyle('', ''), 'Electronic');
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
