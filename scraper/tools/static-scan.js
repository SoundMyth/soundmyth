// Static checks for the scraper tree. Shared by `npm run check` (tools/check.js)
// and test/imports.test.js so the CLI and the test suite can never disagree.
//
// What it verifies:
//   1. syntax      - `node --check` passes for every .js/.mjs under lib/ steps/ tools/ test/
//   2. imports     - every relative import/export/import() specifier resolves to a file
//   3. paths       - every `resolve(__dirname, '<literal>')` points at an existing file
//   4. workflows   - every `node <path>` in .github/workflows/*.yml exists (relative to scraper/)
//   5. layout      - every steps/NN-*.js is run by weekly-scrape.yml, no tools/* is run by CI,
//                    and every lib/*.js is imported by something

import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { basename, dirname, join, resolve, relative } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

export const SCRAPER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_DIR = resolve(SCRAPER_DIR, '..');
export const SOURCE_DIRS = ['lib', 'steps', 'tools', 'test'];

// Written at runtime, so a literal path to them is valid before the first run.
const GENERATED_OUTPUTS = new Set(['conflicts.json', 'run-stats.json']);
// Optional local config; dotenv loads it only when present (CI uses secrets instead).
const OPTIONAL_FILES = new Set(['.env']);

export function listSourceFiles() {
  const out = [];
  const walk = dir => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.m?js$/.test(name)) out.push(p);
    }
  };
  for (const d of SOURCE_DIRS) walk(join(SCRAPER_DIR, d));
  return out.sort();
}

// Strip comments so commented-out imports or example paths do not count.
// Naive on purpose: a `//` inside a string (e.g. 'https://ra.co') is preserved
// because we only drop whole-line `//` comments and block comments.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(l => (/^\s*\/\//.test(l) || /^\s*\*/.test(l) ? '' : l))
    .join('\n');
}

const IMPORT_FROM = /\b(?:import|export)\b[^'";]*?\bfrom\s*['"](\.{1,2}\/[^'"]+)['"]/g;
const IMPORT_BARE = /\bimport\s*['"](\.{1,2}\/[^'"]+)['"]/g;
const DYNAMIC_IMPORT = /\bimport\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g;
const RESOLVE_LITERAL = /resolve\(\s*__dirname\s*,\s*'([^']+)'\s*\)/g;

function matches(re, text) {
  const out = [];
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(text))) out.push({ spec: m[1], index: m.index });
  return out;
}

export function syntaxProblem(file) {
  const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  return r.status === 0 ? null : (r.stderr || r.stdout || 'node --check failed').trim().split('\n').slice(0, 4).join(' | ');
}

export function workflowRunPaths() {
  const dir = join(REPO_DIR, '.github', 'workflows');
  const out = [];
  for (const name of readdirSync(dir).filter(n => n.endsWith('.yml'))) {
    const text = readFileSync(join(dir, name), 'utf8');
    for (const m of text.matchAll(/\bnode\s+(\S+\.m?js)\b/g)) out.push({ workflow: name, path: m[1] });
  }
  return out;
}

/**
 * Analyse the whole scraper tree.
 * @param {{syntax?: boolean}} opts  set syntax:true to also run `node --check` (slower)
 * @returns {{files: string[], problems: {kind: string, file: string, detail: string}[]}}
 */
export function analyze({ syntax = false } = {}) {
  const files = listSourceFiles();
  const problems = [];
  const importedLib = new Set();

  for (const file of files) {
    const rel = relative(SCRAPER_DIR, file).replace(/\\/g, '/');
    const src = stripComments(readFileSync(file, 'utf8'));

    if (syntax) {
      const err = syntaxProblem(file);
      if (err) problems.push({ kind: 'syntax', file: rel, detail: err });
    }

    for (const { spec } of [...matches(IMPORT_FROM, src), ...matches(IMPORT_BARE, src), ...matches(DYNAMIC_IMPORT, src)]) {
      const target = resolve(dirname(file), spec);
      if (!existsSync(target)) {
        problems.push({ kind: 'import', file: rel, detail: `'${spec}' does not exist` });
        continue;
      }
      if (target.startsWith(join(SCRAPER_DIR, 'lib') + (process.platform === 'win32' ? '\\' : '/'))) {
        importedLib.add(target);
      }
    }

    for (const { spec } of matches(RESOLVE_LITERAL, src)) {
      const target = resolve(dirname(file), spec);
      const name = basename(target);
      const ok = existsSync(target)
        || (GENERATED_OUTPUTS.has(name) && existsSync(dirname(target)))
        || (OPTIONAL_FILES.has(name) && existsSync(dirname(target)));
      if (!ok) problems.push({ kind: 'path', file: rel, detail: `__dirname path ${JSON.stringify(spec)} does not exist` });
    }
  }

  // Workflows: every `node <path>` must exist, relative to the job's working-directory (scraper/).
  const runs = workflowRunPaths();
  for (const { workflow, path } of runs) {
    if (!existsSync(resolve(SCRAPER_DIR, path))) {
      problems.push({ kind: 'workflow', file: `.github/workflows/${workflow}`, detail: `node ${path} does not exist` });
    }
  }

  // Layout: classification of steps/ vs tools/ vs lib/ must match what CI runs.
  const weekly = runs.filter(r => r.workflow === 'weekly-scrape.yml').map(r => r.path);
  const allRun = new Set(runs.map(r => r.path));
  for (const f of files) {
    const rel = relative(SCRAPER_DIR, f).replace(/\\/g, '/');
    if (rel.startsWith('steps/') && !weekly.includes(rel)) {
      problems.push({ kind: 'layout', file: rel, detail: 'steps/ file is not run by weekly-scrape.yml' });
    }
    if (rel.startsWith('tools/') && allRun.has(rel)) {
      problems.push({ kind: 'layout', file: rel, detail: 'tools/ file is run by a workflow (move it to steps/)' });
    }
    if (rel.startsWith('lib/') && !importedLib.has(f)) {
      problems.push({ kind: 'layout', file: rel, detail: 'lib/ module is not imported by anything' });
    }
  }

  return { files: files.map(f => relative(SCRAPER_DIR, f).replace(/\\/g, '/')), problems };
}
