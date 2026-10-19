// Manual block list (data/events_block.json): parsing, the pure selection step/12-validate.js uses,
// and the missing-file case.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { parseBlockList, readBlockList, blockedEvents } from '../lib/conflicts.js';

const events = [
  { id: 1, source_id: 'sk_43343846', name: 'Ben Böhmer @ Concourse Project' },
  { id: 2, source_id: 'sk_43216832', name: 'Martin Garrix @ Omnia Las Vegas' },
  { id: 3, source_id: 'sk_43216832_dup', name: 'Other' },
];

test('parseBlockList accepts entries and trims source_id', () => {
  const out = parseBlockList([{ source_id: '  sk_1 ', reason: 'Austin, not Live Oak', added: '2026-10-20' }, { source_id: 'sk_2' }]);
  assert.deepEqual(out, [
    { source_id: 'sk_1', reason: 'Austin, not Live Oak', added: '2026-10-20' },
    { source_id: 'sk_2', reason: '', added: '' },
  ]);
  assert.deepEqual(parseBlockList([]), []);
});

test('parseBlockList rejects anything that is not a list of source_ids (the run stops, nothing is ignored silently)', () => {
  assert.throws(() => parseBlockList({ source_id: 'sk_1' }), /must be a JSON array/);
  assert.throws(() => parseBlockList([{ reason: 'no id' }]), /source_id must be a non-empty string/);
  assert.throws(() => parseBlockList([{ source_id: '   ' }]), /source_id must be a non-empty string/);
  assert.throws(() => parseBlockList([null]), /entry 0/);
  assert.throws(() => parseBlockList([{ source_id: 42 }]), /source_id must be a non-empty string/);
});

test('blockedEvents selects exactly the events whose source_id is listed', () => {
  const blocked = blockedEvents(events, parseBlockList([{ source_id: 'sk_43343846' }]));
  assert.deepEqual(blocked.map(e => e.id), [1]);
});

test('blockedEvents matches source_id exactly, not by prefix or name', () => {
  assert.deepEqual(blockedEvents(events, parseBlockList([{ source_id: 'sk_43216832' }])).map(e => e.id), [2]);
  assert.deepEqual(blockedEvents(events, parseBlockList([{ source_id: 'sk_432' }])), []);
  assert.deepEqual(blockedEvents(events, []), []);
});

test('readBlockList: a missing file is an empty list; a file is parsed; a bad file throws', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sm-block-'));
  assert.deepEqual(readBlockList(join(dir, 'missing.json')), []);
  const good = join(dir, 'good.json');
  writeFileSync(good, JSON.stringify([{ source_id: 'sk_9', reason: 'x', added: '2026-10-20' }]));
  assert.deepEqual(readBlockList(good).map(e => e.source_id), ['sk_9']);
  const bad = join(dir, 'bad.json');
  writeFileSync(bad, '{"not": "a list"}');
  assert.throws(() => readBlockList(bad), /must be a JSON array/);
});
