// `npm run check`: syntax + import/path/workflow/layout checks over the whole scraper tree.
// Exits non-zero on any problem. Same analysis as test/imports.test.js, plus `node --check`.
import { analyze } from './static-scan.js';

const { files, problems } = analyze({ syntax: true });

if (problems.length === 0) {
  console.log(`check OK: ${files.length} files, syntax + imports + paths + workflows + layout`);
  process.exit(0);
}
for (const p of problems) console.error(`[${p.kind}] ${p.file}: ${p.detail}`);
console.error(`check FAILED: ${problems.length} problem(s)`);
process.exit(1);
