// dedupe Pass 2 venue matching (lib/normalize.js venueMatch): containment must not merge a
// venue named after a city with a different venue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { venueMatch } from '../lib/normalize.js';

test('containment still merges real variants: Amnesia / Amnesia Ibiza', () => {
  assert.equal(venueMatch('Amnesia', 'Amnesia Ibiza', 'Ibiza'), true);
  assert.equal(venueMatch('Amnesia Ibiza', 'Amnesia', 'Ibiza'), true);
});

test('containment still merges Ushuaia Ibiza / Ushuaia Ibiza Beach Hotel', () => {
  assert.equal(venueMatch('Ushuaia Ibiza', 'Ushuaia Ibiza Beach Hotel', 'Ibiza'), true);
});

test('a venue named only after the city is not merged with "<Name> <City>" (Sasha @ Pacific Amsterdam)', () => {
  assert.equal(venueMatch('Amsterdam', 'Pacific Amsterdam', 'Amsterdam'), false);
  assert.equal(venueMatch('Pacific Amsterdam', 'Amsterdam', 'Amsterdam'), false);
  assert.equal(venueMatch('Amsterdam', 'Pacific Amsterdam', ''), false);   // hub names are cities too
});

test('a venue named only after the city is not merged with another venue of that city', () => {
  assert.equal(venueMatch('Ibiza', 'Ushuaia Ibiza', 'Ibiza'), false);
  assert.equal(venueMatch('Berlin', 'Berlin Club Xyz', 'Berlin'), false);
});

test('names shorter than 6 characters are not merged by containment', () => {
  assert.equal(venueMatch('Pacha', 'Pacha Ibiza', 'Ibiza'), false);
  assert.equal(venueMatch('Ibiza Bar', 'Ibiza', 'Ibiza'), false);
});

test('a shared city-named prefix does not merge two different venues', () => {
  assert.equal(venueMatch('Amsterdam Arena', 'Amsterdam Dance Event', 'Amsterdam'), false);
});

test('suffix variants with a long shared prefix still merge (Brunch Electronik)', () => {
  assert.equal(venueMatch('Brunch Electronik France', 'Brunch Electronik Bordeaux', 'Bordeaux'), true);
});

test('identical names match, empty names only match each other', () => {
  assert.equal(venueMatch('Tinker Field', ' tinker  field ', 'Orlando'), true);
  assert.equal(venueMatch('', '', 'Orlando'), true);
  assert.equal(venueMatch('', 'Tinker Field', 'Orlando'), false);
});
