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

// /data/artists.json is the single source of DJ genre/photo for the frontend:
// keys must be djKey(name), genres canonical, vibes whitelisted, photos https or "".
test('data/artists.json is well-formed and canonical', async () => {
  const { djKey, STYLES, FALLBACK_GENRE, VIBES } = await import('../genres.js');
  const art = JSON.parse(readFileSync(resolve(__dirname, '../../data/artists.json'), 'utf8'));
  const entries = Object.entries(art.artists || {});
  assert.ok(entries.length > 500, 'artists.json should cover the DJ list');
  const genres = new Set([...STYLES, FALLBACK_GENRE]);
  const vibes = new Set(VIBES);
  for (const [k, a] of entries) {
    assert.equal(k, djKey(a.name), `key "${k}" must equal djKey(name)`);
    assert.ok(genres.has(a.genre), `${a.name}: non-canonical genre "${a.genre}"`);
    assert.ok(a.img === '' || a.img.startsWith('https://'), `${a.name}: bad img`);
    for (const v of a.vibes || []) assert.ok(vibes.has(v), `${a.name}: vibe "${v}" not whitelisted`);
  }
});
