import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import {
  STYLES, FALLBACK_GENRE, VIBES, canonGenre, djStyle, djKey, normVibes,
  buildArtistsIndex, eventGenre, eventTags,
} from '../genres.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const artistsAll = JSON.parse(readFileSync(resolve(__dirname, '../data/artists_all.json'), 'utf8'));

test('taxonomy is exactly the 16 canonical styles plus the fallback', () => {
  assert.equal(STYLES.length, 16);
  assert.deepEqual(new Set(STYLES), new Set([
    'House', 'Tech House', 'Deep House', 'Afro House', 'Melodic Techno', 'Techno',
    'Hard Techno', 'Trance', 'Psytrance', 'Progressive', 'Big Room', 'Bass',
    'Drum & Bass', 'Hardstyle', 'Indie Dance', 'Electro',
  ]));
  assert.equal(FALLBACK_GENRE, 'Multi-genre');
});

test('canonGenre: legacy labels map to canonical styles', () => {
  assert.equal(canonGenre('Big Room / Festival EDM'), 'Big Room');
  assert.equal(canonGenre('Bass Music'), 'Bass');
  assert.equal(canonGenre('Indie Dance / Leftfield'), 'Indie Dance');
  assert.equal(canonGenre('Drum & Bass / Breaks'), 'Drum & Bass');
  assert.equal(canonGenre('Progressive House'), 'Progressive');
  assert.equal(canonGenre('Hard Dance'), 'Hardstyle');
  assert.equal(canonGenre('Hardcore'), 'Hardstyle');
  assert.equal(canonGenre('Acid House'), 'House');
  assert.equal(canonGenre('Melodic House'), 'Melodic Techno');
  assert.equal(canonGenre('Melodic House & Techno'), 'Melodic Techno');
});

test('canonGenre: generic labels fall back to Multi-genre, unknown to null', () => {
  assert.equal(canonGenre('Electronic'), FALLBACK_GENRE);
  assert.equal(canonGenre('Pop'), FALLBACK_GENRE);
  assert.equal(canonGenre('Pop Electronic / Crossover'), FALLBACK_GENRE);
  assert.equal(canonGenre('UNKNOWN'), null);
  assert.equal(canonGenre(''), null);
  assert.equal(canonGenre(undefined), null);
  assert.equal(canonGenre('Polka'), null);
});

test('canonGenre: canonical input is idempotent and case-insensitive', () => {
  for (const s of STYLES) assert.equal(canonGenre(s), s);
  assert.equal(canonGenre('tech house'), 'Tech House');
  assert.equal(canonGenre('DRUM & BASS'), 'Drum & Bass');
});

test('canonGenre: subgenre refines a coarse genre', () => {
  assert.equal(canonGenre('House', 'Tech House'), 'Tech House');
  assert.equal(canonGenre('Techno', 'Hard Techno'), 'Hard Techno');
  assert.equal(canonGenre('Bass Music', 'Drum & Bass'), 'Drum & Bass');
  assert.equal(canonGenre('House', 'Melodic House'), 'Melodic Techno');
});

test('djStyle never returns the fallback', () => {
  assert.equal(djStyle('Electronic'), null);
  assert.equal(djStyle('Pop Electronic / Crossover', 'Dance Pop'), null);
  assert.equal(djStyle('Techno'), 'Techno');
});

test('djKey matches the contract key function', () => {
  assert.equal(djKey('Above & Beyond'), 'aboveandbeyond');
  assert.equal(djKey('Beyoncé'), 'beyonce');
  assert.equal(djKey("Don't F**k with Disco"), 'dontfkwithdisco');
  assert.equal(djKey(' DJ  Snake! '), 'djsnake');
  assert.equal(djKey(''), '');
});

test('normVibes keeps whitelist only, maps commercial->mainstream, drops junk tags', () => {
  assert.deepEqual(normVibes('melodic, commercial, festival, discovered, UNKNOWN, dj, club'), ['melodic', 'mainstream']);
  assert.deepEqual(normVibes(['songkick', 'ra', 'bandsintown', 'website', 'direct', 'Techno']), []);
  assert.deepEqual(normVibes('hard, hard, dark'), ['hard', 'dark']);
  for (const v of normVibes(VIBES.join(','))) assert.ok(VIBES.includes(v));
});

test('normVibes: underground and mainstream together are both dropped', () => {
  assert.deepEqual(normVibes('underground, mainstream, melodic'), ['melodic']);
  assert.deepEqual(normVibes('underground, commercial'), []);
  assert.deepEqual(normVibes('underground, hard'), ['underground', 'hard']);
});

const idx = buildArtistsIndex([
  { ranking: 1, name: 'Alpha', genre: 'Techno', tags: 'dark, underground' },
  { ranking: 2, name: 'Beta', genre: 'House', tags: 'melodic' },
  { ranking: 3, name: 'Gamma', genre: 'Techno', tags: 'hard, mainstream' },
  { ranking: 4, name: 'Delta', genre: 'Trance', tags: 'emotional' },
  { ranking: 5, name: 'Epsilon', genre: 'Electronic', tags: 'discovered' },
  { ranking: 6, name: 'Zeta', genre: 'Trance', tags: 'emotional, vocal, afro, classic' },
]);

test('eventGenre: most frequent known genre wins', () => {
  assert.equal(eventGenre(['Alpha', 'Gamma', 'Beta'], idx), 'Techno');
});

test('eventGenre: tie goes to the genre of the highest-ranked DJ', () => {
  // Techno (Alpha, rank 1) vs House (Beta, rank 2): 1 each -> Techno
  assert.equal(eventGenre(['Beta', 'Alpha'], idx), 'Techno');
  // House (Beta, rank 2) vs Trance (Delta, rank 4), lineup order irrelevant
  assert.equal(eventGenre(['Delta', 'Beta'], idx), 'House');
});

test('eventGenre: ties on rank fall back to lineup order', () => {
  const tie = buildArtistsIndex([
    { ranking: 10, name: 'X', genre: 'House' },
    { ranking: 10, name: 'Y', genre: 'Trance' },
  ]);
  assert.equal(eventGenre(['Y', 'X'], tie), 'Trance');
  assert.equal(eventGenre(['X', 'Y'], tie), 'House');
});

test('eventGenre: DJs not in the list rank last in ties', () => {
  assert.equal(eventGenre(['Unknown Person', 'Delta', 'Beta'], idx), 'House');
});

test('eventGenre: unknown or generic DJs are ignored; no known DJ -> festival style -> Multi-genre', () => {
  assert.equal(eventGenre(['Epsilon', 'Nobody'], idx), FALLBACK_GENRE);
  assert.equal(eventGenre(['Epsilon'], idx, 'Hardstyle'), 'Hardstyle');
  assert.equal(eventGenre([], idx), FALLBACK_GENRE);
  assert.equal(eventGenre([], idx, 'Electronic'), FALLBACK_GENRE);
  assert.equal(eventGenre(['Nobody'], idx, 'Big Room'), 'Big Room');
});

test('eventGenre: festival style is ignored when a known DJ is present', () => {
  assert.equal(eventGenre(['Beta'], idx, 'Techno'), 'House');
});

test('eventTags: type first, then at most 3 most frequent vibes', () => {
  const tags = eventTags(['Alpha', 'Gamma', 'Zeta', 'Beta'], idx, 'festival');
  assert.equal(tags[0], 'festival');
  assert.ok(tags.length <= 4);
  assert.ok(tags.slice(1).every(v => VIBES.includes(v)));
});

test('eventTags: never both underground and mainstream', () => {
  // Alpha: underground; Gamma: mainstream (+hard). Counts 1 vs 1 -> both dropped
  const tie = eventTags(['Alpha', 'Gamma'], idx);
  assert.equal(tie.includes('underground') && tie.includes('mainstream'), false);
  assert.ok(!tie.includes('underground'));
  assert.ok(!tie.includes('mainstream'));
  assert.ok(tie.includes('hard'));
  // underground x2 vs mainstream x1 -> keep underground
  const more = buildArtistsIndex([
    { ranking: 1, name: 'U1', genre: 'Techno', tags: 'underground' },
    { ranking: 2, name: 'U2', genre: 'Techno', tags: 'underground' },
    { ranking: 3, name: 'M1', genre: 'Techno', tags: 'mainstream' },
  ]);
  const t = eventTags(['U1', 'U2', 'M1'], more);
  assert.deepEqual(t, ['underground']);
});

test('eventTags: junk and source tags never leak; type only festival/club', () => {
  assert.deepEqual(eventTags(['Nobody'], idx, 'festival'), ['festival']);
  assert.deepEqual(eventTags(['Nobody'], idx, 'songkick'), []);
  assert.deepEqual(eventTags([], idx, 'club'), ['club']);
  assert.deepEqual(eventTags(['Nobody'], idx), []);
});

test('artists_all.json: every DJ genre is canonical (no generic / legacy labels left)', () => {
  const bad = artistsAll.filter(a => {
    const g = djStyle(a.genre, null);
    return !g || !STYLES.includes(g) || a.genre !== g;
  }).map(a => `${a.name} = ${a.genre}`);
  assert.deepEqual(bad, []);
});

test('artists_all.json: every DJ tags value is within the vibe whitelist', () => {
  for (const a of artistsAll) {
    const raw = String(a.tags || '').split(',').map(s => s.trim()).filter(Boolean);
    for (const t of raw) assert.ok(VIBES.includes(t), `${a.name}: tag "${t}" not in whitelist`);
  }
});
