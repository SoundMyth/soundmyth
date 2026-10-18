import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanLineup } from '../normalize.js';

test('cleanLineup: b2b and vs split into two DJs', () => {
  assert.deepEqual(cleanLineup(['Dixon b2b Amelie Lens']), ['Dixon', 'Amelie Lens']);
  assert.deepEqual(cleanLineup(['Adam Beyer B2B Joseph Capriati']), ['Adam Beyer', 'Joseph Capriati']);
  assert.deepEqual(cleanLineup(['Alok vs Martin Garrix']), ['Alok', 'Martin Garrix']);
});

test('cleanLineup: junk placeholders are removed', () => {
  const junk = ['&friends', 'and friends', '& Friends', 'Special Guests', 'TBA', 'TBC',
                'more to be announced', 'More TBA', 'vs', 'b2b', '+ more', '...', 'Live'];
  assert.deepEqual(cleanLineup(['Tiësto', ...junk]), ['Tiësto']);
});

test('cleanLineup: "& friends" suffix and "(AU)" country tags are stripped', () => {
  assert.deepEqual(cleanLineup(['Dixon & Friends']), ['Dixon']);
  assert.deepEqual(cleanLineup(['Levi (AU)']), ['Levi']);
});

test('cleanLineup: real artists whose names look odd are kept', () => {
  const real = ['&ME', 'ØTTA', 'ÜBERKIKZ', 'ARTBAT', 'Above & Beyond', 'D-Block & S-te-Fan', 'Friendly Fire'];
  assert.deepEqual(cleanLineup(real), real);
});

test('cleanLineup: de-duplicates case-insensitively, keeps order, tolerates bad input', () => {
  assert.deepEqual(cleanLineup(['Alok', 'ALOK', 'Alok ']), ['Alok']);
  assert.deepEqual(cleanLineup(undefined), []);
  assert.deepEqual(cleanLineup(null), []);
  assert.deepEqual(cleanLineup(['', ' ', 'x']), []);   // single-char junk dropped
});
