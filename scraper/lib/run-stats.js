/**
 * SoundMyth – per-run stats handed from pipeline steps to report.js.
 *
 * Each step (dedupe, validate, purge) writes ONE section of data/run-stats.json:
 *   { "dedupe": {...}, "validate": {...}, "purge": {...} }
 * Every section carries `generated` (ISO timestamp). report.js only trusts a section
 * generated at/after RUN_STARTED, so a step that died this week cannot leak last week's
 * numbers into the email. Committed with the other scraper/data/*.json files.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const RUN_STATS_PATH = resolve(__dirname, '../data/run-stats.json');

export function readRunStats(path = RUN_STATS_PATH) {
  try {
    return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  } catch {
    return {};
  }
}

/** Replace one section of the stats file; other steps' sections are preserved. */
export function writeRunStat(section, data, path = RUN_STATS_PATH) {
  const all = readRunStats(path);
  all[section] = { generated: new Date().toISOString(), ...data };
  writeFileSync(path, JSON.stringify(all, null, 2) + '\n');
}
