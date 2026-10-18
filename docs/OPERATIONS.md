# Operations runbook

How the weekly pipeline runs, what each data file is, and the common manual tasks.
For the architecture overview see [../README.md](../README.md); for the rules that
prevent repeat bugs see [BUGS.md](BUGS.md).

## Schedules and workflows

| Workflow | Trigger | What it does |
|---|---|---|
| `weekly-scrape.yml` "Weekly Scrape & Purge" | Sundays 02:00 UTC, or manual | Runs the 17 pipeline steps, commits `scraper/data/*.json` and `data/artists.json`, emails a run report |
| `cleanup-db.yml` "Clean DB" | Manual | Refreshes candidates, then `steps/11-cleanup-junk.js` (junk removal, city/DJ canonicalisation). About 1 minute |
| `keepalive.yml` "Keep Supabase awake" | Every second day 06:00 UTC, or manual | One cheap read so the free-tier project is never paused for inactivity |
| `ci.yml` "CI" | Every push and pull request | Offline only: `npm run check` and `npm test`. No secrets |

Job timeout for the weekly run is 180 minutes. Every step has `continue-on-error`,
except the final "Verify wrote data" step, which fails the run when Supabase is
unreachable or holds fewer than 100 future events.

## Weekly pipeline (in run order)

Each step is `scraper/steps/NN-name.js`. Run one locally with `npm run step:<name>`
(for example `npm run step:dedupe`); `<name>` is the file name without the prefix.

| # | File | Does |
|---|---|---|
| 01 | `01-enrich-songkick-urls.js` | Finds Songkick URLs for DJs that lack one |
| 02 | `02-scrape-extended.js` | Every DJ in `artists_all.json` → Bandsintown, then Songkick fallback → `events` |
| 03 | `03-discover-festivals.js` | Adds new editions of touring brands and RA-verified festivals to `festivals_all.json`; uncertain ones go to `festivals_candidates.json`. Read-only on the DB |
| 04 | `04-scrape-festivals-bit.js` | Festivals × Bandsintown + Songkick |
| 05 | `05-scrape-festivals-direct.js` | Festival websites (Playwright Chromium) |
| 06 | `06-scrape-festivals-ra.js` | Festivals via Resident Advisor (matches on name prefix and area) |
| 07 | `07-enrich-clubs-ra.js` | Fills `ra_url` for clubs that lack one (ra.co only) |
| 08 | `08-scrape-clubs-ra.js` | Clubs × RA GraphQL |
| 09 | `09-dedupe.js` | Merges duplicates and festival fragments; resolves double bookings into `conflicts.json`. Skips merge/delete passes if the event load was partial |
| 10 | `10-discover-djs.js` | Finds DJs in events that are not in our list and verifies them on RA → `artists_candidates.json` |
| 11 | `11-cleanup-junk.js` | **Deletes** events whose lineup has no EDM presence; canonicalises DJ and city spellings. Respects `artists_allow.json` and `artists_block.json` |
| 12 | `12-validate.js` | Fixes countries, lineups and genres; drops events with no location, invalid dates, or dates more than 15 months ahead |
| 13 | `13-classify.js` | Recomputes `genre` and `tags` for all upcoming events (canonical styles) |
| 14 | `14-enrich-images.js` | Festival og:images and DJ photos, within `DJ_TIME_BUDGET_MIN` (resumable) |
| 15 | `15-build-artists.js` | Writes `data/artists.json`, the DJ artifact the frontend reads |
| 16 | `16-purge.js` | **Deletes** events older than 8 days, plus orphaned `saved_events`. The only step that deletes by date |
| – | commit step | Commits `scraper/data/*.json` and `data/artists.json` (`git pull --rebase` before push) |
| – | verify step | Fails the run if fewer than 100 future events exist |
| 17 | `17-report.js` | Emails the Brevo run report (outcomes, conflicts to review, validation counts, new festivals) |

Step 11 can permanently delete events. Add a DJ to `artists_allow.json` to rescue a
false positive, and to `artists_block.json` to force-remove one.

## Data files (`scraper/data/`)

Kind: **input** = curated by hand, **cache** = safe to delete (rebuilt on demand),
**output** = written by a run and committed, **reference** = read by a single step.

| File | Kind | Read / written by | Notes |
|---|---|---|---|
| `artists_all.json` | input | steps 01, 02, 10, 11, 13, 14, 15 | DJ list that drives the scrapers. `genre` is always a canonical style |
| `artists_allow.json` | input | steps 10, 11 | Manual rescue list: never cleaned up as junk |
| `artists_block.json` | input | steps 10, 11, tools | Manual block list: off-genre DJs (RA false positives) |
| `artists_top100.json` | reference | step 15 | Sets the `top100` flag in `artists.json`. The frontend keeps its own mirror; edit both |
| `artists_candidates.json` | output | step 10 | RA verification cache. Only new DJs are checked; `err: true` means uncertain and is kept |
| `clubs_all.json` | input | steps 07, 08, 12 | Club registry; also gives venue evidence for geo fixes |
| `clubs_top100.json` | reference | step 08 | Fallback only when `clubs_all.json` is missing |
| `festivals_all.json` | input + output | steps 03, 04, 05, 06, 14 | Manual rows plus automatic additions from step 03 |
| `festivals_top100.json` | reference | none | Kept for reference; not read by any step |
| `festival_brands.json` | input | step 03 | 18 touring brands with aliases, exclusions and style |
| `festivals_candidates.json` | output | step 03 | Created on the first run that finds candidates. `status`: pending, added or rejected. Set `rejected` to stop re-listing |
| `dj_images_overrides.json` | input | step 14, 15 | Manual photo decisions: `{djKey: url}` or `""` to force initials. Wins over the cache |
| `dj_images_cache.json` | cache | step 14 | Keyed by djKey. Bump `DJ_CACHE_VERSION` in `steps/14-enrich-images.js` to retry failures |
| `festival_images_cache.json` | cache | step 14 | Festival og:image lookups |
| `conflicts.json` | output | step 09, read by step 17 | Overwritten each run; double bookings to review |
| `run-stats.json` | output | steps 09, 12, 16, 03; read by step 17 | One section per step; report only trusts sections written during this run |

The genre audit behind the 2026-10 reclassification is in
[genre-audit-2026-10.md](genre-audit-2026-10.md). It lists low-confidence DJs for
founder review.

## Common tasks

### Add a DJ
1. Add an entry to `scraper/data/artists_all.json`: `name` (exact spelling used on
   Bandsintown and Songkick), `genre` (one of the canonical styles), and optional `tags`.
   Edit on GitHub or locally.
2. Optional: `npm run step:enrich-songkick-urls` to find the Songkick URL now.
3. Commit, then trigger the weekly workflow, or wait for Sunday.

To show a DJ in UPCOMING HIGHLIGHTS, also add them to the `TOP100_DJS` set in `web/index.html`.

### Add a festival
Either add a row to `festivals_all.json` (`name`, `city`, `country`, `website`,
`sk_url`, `ranking`, optional `style`), or wait for step 03 to find it, then promote or
reject it in `festivals_candidates.json`. A festival that is not on RA gets events
only from the website scraper (step 05), so set `website` for those.

### Add a club
Add a row to `clubs_all.json` with `name`, `city`, `country`. `ra_url` is optional:
step 07 fills it. If the club is not on RA, step 08 finds nothing for it, which is fine.

### Run a step locally
```bash
cd web/scraper
npm ci
npm run step:dedupe    # or any other step
```
`.env` needs `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`. Steps 03 and 10 accept
`SUPABASE_ANON_KEY` instead, since they are read-only. Step 02 also needs `BIT_APP_ID`.

Offline dry runs that need no Supabase access:
```bash
node steps/13-classify.js --dry-run --snapshot path/to/events.json
node steps/03-discover-festivals.js --dry-run
EVENTS_JSON=path/to/events.json node steps/15-build-artists.js   # overwrites data/artists.json
```
`build-artists` rewrites `web/data/artists.json`. If the only change is `generated`, run
`git checkout -- ../data/artists.json`.

### Trigger a manual scrape
GitHub → Actions → "Weekly Scrape & Purge" → Run workflow. About 90 minutes.

### Clean the database without a full scrape
GitHub → Actions → "Clean DB" → Run workflow.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Verify step red, "Supabase did not resolve" | Free-tier project paused | Restore it in the Supabase dashboard; keepalive runs every second day |
| DJ has 0 events | Name spelling differs from Bandsintown or Songkick | Check the exact spelling on bandsintown.com; fix `artists_all.json` |
| Festival shows one DJ | Dedupe did not run, or the load was partial | Re-run the workflow; dedupe consolidates per-DJ fragments |
| Events duplicated | Venue normalisation missed a variant | Check `lib/normalize.js` venue normalisation and add a test |
| Missing country flag | Country not in `FLAGS` / `COUNTRY_ISO` | Add to `FLAGS` and `COUNTRY_ISO` in `web/index.html`, and map the alias in `canonCountry` (`scraper/lib/normalize.js`) |
| DJ with no photo | No verified source | Add an override in `dj_images_overrides.json` or wait for the cache to retry |
| Festival with no photo | JS-rendered site (Tomorrowland, EDC) | Add to `FESTIVAL_IMAGE_OVERRIDES` in `steps/14-enrich-images.js` |
| Image lookups stale after a search change | Cache keeps old failures | Bump `DJ_CACHE_VERSION` (or `FEST_CACHE_VERSION`) |
| RA results all empty | RA throttling (HTTP 200 with empty results) | Steps 03 and 10 back off and report unknowns instead of guessing; re-run later |
