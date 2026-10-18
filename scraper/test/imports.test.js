// Safety net for the file moves: every import, every __dirname-relative data path,
// every workflow `node <path>` and the lib/steps/tools classification must hold.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../tools/static-scan.js';

const { files, problems } = analyze({ syntax: false });
const of = kind => problems.filter(p => p.kind === kind).map(p => `${p.file}: ${p.detail}`);

test('scanner sees the source tree', () => {
  assert.ok(files.some(f => f.startsWith('steps/')), 'no steps/ files found');
  assert.ok(files.some(f => f.startsWith('lib/')), 'no lib/ files found');
});

test('every relative import resolves', () => assert.deepEqual(of('import'), []));

test('every resolve(__dirname, "<literal>") path exists', () => assert.deepEqual(of('path'), []));

test('every `node <path>` in .github/workflows exists', () => assert.deepEqual(of('workflow'), []));

test('layout: steps run by CI, tools not run by CI, lib imported', () => assert.deepEqual(of('layout'), []));
