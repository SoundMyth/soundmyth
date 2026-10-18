// Every offset-paged read (`.range(`) must order by the unique `id`. Ordering by date alone
// lets Postgres return the same row on two pages and skip another (dedupe then deleted its own
// keeper). Enforced by reading the source: a new pager without `.order('id'` fails here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const SCRAPER = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = ['lib', 'steps', 'tools'].flatMap(d =>
  readdirSync(join(SCRAPER, d)).filter(f => /\.(c|m)?js$/.test(f)).map(f => join(d, f)));

test('the scan sees the pagers it must cover', () => {
  const pagers = files.filter(f => readFileSync(join(SCRAPER, f), 'utf8').includes('.range('));
  assert.ok(pagers.length >= 8, `expected at least 8 files with .range(, found ${pagers.length}`);
});

for (const f of files) {
  test(`${f}: every paged query orders by id`, () => {
    const text = readFileSync(join(SCRAPER, f), 'utf8');
    for (const m of text.matchAll(/\.range\(/g)) {
      const line = text.slice(text.lastIndexOf('\n', m.index) + 1, text.indexOf('\n', m.index));
      if (/^\s*(\*|\/\/)/.test(line)) continue;            // doc comments mention .range(
      const start = text.lastIndexOf('from(', m.index);
      const chain = text.slice(start, m.index + 200);       // .order() may sit on either side of .range()
      const line1 = text.slice(0, m.index).split('\n').length;
      assert.match(chain, /\.order\(\s*'id'/, `${f}:${line1} pages without .order('id')`);
    }
  });
}
