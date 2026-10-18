import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonCity, canonCountry, resolveGeo, makeClubLookup, cityKey } from '../normalize.js';

test('canonCity: borough and sub-area names fold into the city (contract §6)', () => {
  assert.equal(canonCity('Brooklyn'), 'New York');
  assert.equal(canonCity('Manhattan'), 'New York');
  assert.equal(canonCity('Queens'), 'New York');
  assert.equal(canonCity('New York City'), 'New York');
  assert.equal(canonCity('The Bronx'), 'New York');
  assert.equal(canonCity('New York'), 'New York');
});

test('canonCity: spelling variants of big cities', () => {
  assert.equal(canonCity('Tokio'), 'Tokyo');
  assert.equal(canonCity('Ciudad De Mexico'), 'Mexico City');
  assert.equal(canonCity('Ciudad de México'), 'Mexico City');
  assert.equal(canonCity('St Polten'), 'St. Polten');
  assert.equal(canonCity('St. Pölten'), 'St. Polten');
});

test('canonCity: RA area labels that are not cities become empty', () => {
  assert.equal(canonCity('All'), '');
  assert.equal(canonCity('all'), '');
  assert.equal(canonCity('TBA'), '');
});

test('canonCountry: Saint Barthélemy casing variants', () => {
  assert.equal(canonCountry('Saint BarthÉlemy'), 'Saint Barthélemy');
  assert.equal(canonCountry('Saint Barthélemy'), 'Saint Barthélemy');
});

test('cityKey: boroughs and "New York" are the same city', () => {
  assert.equal(cityKey('Manhattan'), cityKey('New York'));
  assert.notEqual(cityKey('Amsterdam'), cityKey('New York'));
  assert.equal(cityKey('All'), '');
});

test('resolveGeo: empty country filled from a hub city', () => {
  const g = resolveGeo({ city: 'New York', country: '', venue: 'Knockdown' });
  assert.equal(g.country, 'United States');
  assert.equal(g.countryFilled, true);
});

test('resolveGeo: hub mismatch is FLAGGED, not guessed, without venue evidence', () => {
  const g = resolveGeo({ city: 'Amsterdam', country: 'United States', venue: 'Prime Club' });
  assert.equal(g.country, 'United States');
  assert.equal(g.hubFixed, false);
  assert.match(g.hubFlag, /Amsterdam listed in United States/);
});

test('resolveGeo: hub mismatch is FIXED when the venue is known to be in the hub country', () => {
  const lookup = makeClubLookup([{ name: 'Prime Club', city: 'Amsterdam', country: 'Netherlands' }]);
  const g = resolveGeo({ city: 'Amsterdam', country: 'United States', venue: 'Prime Club' }, lookup);
  assert.equal(g.country, 'Netherlands');
  assert.equal(g.hubFixed, true);
  assert.equal(g.hubFlag, null);
});

test('resolveGeo: legitimate homonyms are kept (London ON, Paris TX)', () => {
  assert.equal(resolveGeo({ city: 'London', country: 'Canada' }).hubFlag, null);
  assert.equal(resolveGeo({ city: 'London', country: 'Canada' }).country, 'Canada');
  assert.equal(resolveGeo({ city: 'Paris', country: 'United States' }).hubFlag, null);
});

test('resolveGeo: RA "All" area falls back to the venue club city (Cafe del Mar → Phuket)', () => {
  const lookup = makeClubLookup([{ name: 'Cafe del Mar', city: 'Phuket', country: 'Thailand' }]);
  const g = resolveGeo({ city: 'All', country: 'Thailand', venue: 'Cafe del Mar' }, lookup);
  assert.equal(g.city, 'Phuket');
  assert.equal(g.cityFallback, true);
  assert.equal(g.country, 'Thailand');
});

test('resolveGeo: empty city with no club match stays empty (validate drops it)', () => {
  const g = resolveGeo({ city: '', country: 'Spain', venue: 'Unknown Place' });
  assert.equal(g.city, '');
});

test('resolveGeo: a city that is only the country name carries no city', () => {
  const g = resolveGeo({ city: 'Mexico', country: 'Mexico', venue: 'X' });
  assert.equal(g.city, '');
});

test('makeClubLookup: exact venue match only ("Pacha New York" must not match Pacha Ibiza)', () => {
  const lookup = makeClubLookup([{ name: 'Pacha', city: 'Ibiza', country: 'Spain' }]);
  assert.equal(lookup('Pacha')?.city, 'Ibiza');
  assert.equal(lookup('Pacha New York'), null);
});
