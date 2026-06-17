import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { CITY_ALIAS_RAW } from '../normalize.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');

// Extract an object literal `const NAME={...};` from index.html and evaluate it.
function extractObject(name) {
  const m = html.match(new RegExp('const ' + name + '\\s*=\\s*(\\{[\\s\\S]*?\\});'));
  assert.ok(m, `${name} not found in index.html`);
  return Function('return (' + m[1] + ')')();
}

// The city-alias map is hand-kept in BOTH index.html (frontend) and scraper/normalize.js.
// This guards against the two drifting apart.
test('CITY_ALIAS_RAW is identical in index.html and scraper/normalize.js', () => {
  const frontend = extractObject('CITY_ALIAS_RAW');
  assert.deepEqual(frontend, CITY_ALIAS_RAW);
});

// Sanity: the frontend DJ_GENRE map is non-empty and well-formed (drives "styles").
test('frontend DJ_GENRE map is present and non-trivial', () => {
  const djGenre = extractObject('DJ_GENRE');
  assert.ok(Object.keys(djGenre).length > 50, 'DJ_GENRE should cover many DJs');
  for (const [dj, g] of Object.entries(djGenre)) {
    assert.equal(dj, dj.toLowerCase(), `DJ_GENRE key "${dj}" must be lowercased`);
    assert.equal(typeof g, 'string');
  }
});
