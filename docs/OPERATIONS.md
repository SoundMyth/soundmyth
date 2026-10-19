# Operations runbook

How the weekly pipeline runs, what each data file is, and the common manual tasks.
For the architecture overview see [../README.md](../README.md); for the rules that
prevent repeat bugs see [BUGS.md](BUGS.md).

## Schedules and workflows

| Workflow | Trigger | What it does |
|---|---|---|
| `weekly-scrape.yml` "Weekly Scrape & Purge" | Sundays 02:00 UTC, or manual | Runs the 17 pipeline steps, commits `scraper/data/*.json` and `public/data/artists.json`, emails a run report |
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
| 09 | `09-dedupe.js` | Merges duplicates and festival fragments, and names merged festival keepers by edition. Detects double bookings into `conflicts.json` and **never deletes** them. Skips merge/delete passes if the event load was partial |
| 10 | `10-discover-djs.js` | Finds DJs in events that are not in our list and verifies them on RA → `artists_candidates.json` |
| 11 | `11-cleanup-junk.js` | **Deletes** events whose lineup has no EDM presence; canonicalises DJ and city spellings. Respects `artists_allow.json` and `artists_block.json` |
| 12 | `12-validate.js` | Fixes countries and lineups (genre is left to step 13); drops events with no location, invalid dates, or dates more than 15 months ahead; **deletes** events listed in `events_block.json` (every run, after the scrape); flags Songkick namesakes for review (deletes one only if a rule is enabled, see "Namesakes") |
| 13 | `13-classify.js` | Recomputes `genre` and `tags` for all upcoming events (canonical styles) |
| 14 | `14-enrich-images.js` | Festival og:images and DJ photos, within `DJ_TIME_BUDGET_MIN` (resumable) |
| 15 | `15-build-artists.js` | Writes `public/data/artists.json`, the DJ artifact the frontend reads |
| 16 | `16-purge.js` | **Deletes** events older than 8 days, plus orphaned `saved_events`. The only step that deletes by date |
| – | commit step | Commits `scraper/data/*.json` and `public/data/artists.json` (`git pull --rebase` before push) |
| – | verify step | Fails the run if fewer than 100 future events exist |
| 17 | `17-report.js` | Emails the Brevo run report (outcomes, conflicts to review, namesakes dropped and suspected, validation counts, new festivals) |

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
| `events_block.json` | input | step 12 | Manual block list of events (`source_id`), deleted every run. Starts as `[]`. See "Reviewing double bookings" |
| `events_allow.json` | input | step 12 | Rescue list of events (`source_id`) that are never flagged or dropped as Songkick namesakes. Starts as `[]`. See "Namesakes" |
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
| `conflicts.json` | output | step 09, read by step 17 | Overwritten each run. `likelyErrors` (different countries), `possibleDoubleHeaders` (same country), `ignoredFestival` (festival-like appearances, not conflicts). Detection only |
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
EVENTS_JSON=path/to/events.json node steps/15-build-artists.js   # overwrites public/data/artists.json
```
`build-artists` rewrites `web/public/data/artists.json`. If the only change is `generated`, run
`git checkout -- ../public/data/artists.json`.

### Reviewing double bookings
Reviewing conflicts: open the email, decide which event is wrong, add its source_id to events_block.json (GitHub web editor is fine), it disappears next run.

The weekly email lists two groups, from `scraper/data/conflicts.json`:
- **Likely errors to review**: the same DJ on the same day in two different countries. Usually one listing is wrong. Each event's `source_id` is shown in monospace.
- **Possible double-headers**: the same DJ in two cities of one country on one day. Often two real shows (a double-header), so these are informational.

Festival appearances are not conflicts. Songkick dates every artist's festival slot with the festival's first day, so a DJ at a multi-day festival on day 1 and a club elsewhere that day is expected. The email counts them as "Festival appearances ignored". A festival that no signal catches (for example a festival name without "festival" or "fest") can still show as a likely error. Block it the same way, or add the festival to `festivals_all.json`.

To block an event, add an entry to `scraper/data/events_block.json`:

```json
[
  { "source_id": "sk_43343846", "reason": "Wrong listing: the DJ is booked elsewhere that day", "added": "2026-10-20" }
]
```

`source_id` must match exactly. Step 12 deletes each listed event on every run, after the scrape, so a scraper that re-adds it is undone the same week. Once the bad listing is gone at the source, remove its entry, so the file stays short. A malformed file fails step 12 on purpose, so a typo cannot silently bring the event back.

### Namesakes: what is dropped automatically, how to rescue one, how to block one

Songkick merges every act with the same name into one artist page. A DJ's calendar can
therefore hold another act's gigs: "Luciano" the German rapper playing a Pavarotti tribute
in a hotel, "Kanine" at a rock venue in France, "Afrojack" at a tavern in Melbourne.

**What is dropped automatically: nothing yet.** `AUTO_DROP_RULES` in `scraper/lib/namesake.js`
is empty. A rule may delete only when it reaches 95% precision on the hand-verified audit
(`scraper/test/fixtures/namesake-audit-2026-10.json`). None did (table below), so step 12
drops no namesake. The `namesakeDropped` count and the email section "Dropped as namesakes"
are wired and will show any event a future rule drops.

**What is flagged:** the email section "Suspected namesakes (review)" lists up to 15 events,
most suspicious first. The rule (`review` in `lib/namesake.js`) is: a single-DJ Songkick event
where no other known DJ plays the venue, the venue is not in `clubs_all.json`, and either the venue
name is non-electronic (church, cabaret, tavern, hotel, museum, kulturzentrum...) or the DJ name is
one word of at most seven letters. Flagged events stay in the database. The full list is in
`data/run-stats.json` under `namesake`. The total is in the email's heading.

**How to rescue a flagged event (keep it):** add its `source_id` to `scraper/data/events_allow.json`.
Allow-listed events are never flagged and never dropped:

```json
[
  { "source_id": "sk_43xxxxxx", "reason": "Luciano at Die Glocke is the Swiss DJ, not the rapper", "added": "2026-10-27" }
]
```

**How to block one (remove it):** add its `source_id` to `scraper/data/events_block.json`, as for a
double booking. Step 12 deletes it every run.

A malformed `events_allow.json` fails step 12 on purpose, so a typo cannot silently bring a
rescued event back into the email.

**Measured precision (2026-10-19 audit).** Population: 2,341 Songkick single-DJ events of known DJs
(live snapshot). Sample: 110, stratified by signal and verified on the web (strata C 16 of 24,
B 22 of 52, A 22 of 838, D 10 of 106, E 10 of 392, none 30 of 929). "Precision" is the share of
namesakes among decided events that a rule flags. "Unknown" (no evidence either way) is excluded
from precision and is large: 55 of 110. Recall is over the 7 namesakes found in the sample.

| Signal or rule | Flagged | Namesake | Correct | Unknown | Precision (decided) | Recall (of 7) |
|---|---|---|---|---|---|---|
| venue orphan (no other known DJ at venue, not a club) | 45 | 6 | 19 | 20 | 24% | 6/7 |
| non-electronic venue word | 24 | 5 | 9 | 10 | 36% | 5/7 |
| one-word name (≤ 7 letters) | 34 | 5 | 11 | 18 | 31% | 5/7 |
| same DJ, same day, other country | 16 | 3 | 8 | 5 | 27% | 3/7 |
| same DJ, next day, other country | 26 | 3 | 14 | 9 | 18% | 3/7 |
| venue in clubs_all.json | 7 | 0 | 3 | 4 | 0% | 0/7 |
| orphan AND non-electronic venue | 16 | 4 | 6 | 6 | 40% | 4/7 |
| orphan AND one-word name | 13 | 4 | 2 | 7 | 67% | 4/7 |
| **review rule**: orphan AND (non-electronic venue OR one-word name) | 24 | 6 | 7 | 11 | 46% | 6/7 |
| any signal (strata C, B, A, D, E) | 80 | 7 | 35 | 38 | 17% | 7/7 |

Read with care. Recall is in-sample and the strata are not population-weighted. The unknowns
are the real limit: if they were all namesakes, the namesake share of the live population would
be far higher than the 5% that the decided verdicts imply. The web search cannot confirm most small-club
dates, so the audit cannot say how common namesakes are. That is why nothing auto-drops.

**Live counts (2026-10-19 snapshot, 2,671 events after blocks):** auto-dropped 0; flagged for review
308 (the email shows the 15 most suspicious). Orphan AND non-electronic venue alone: 37. The
namesake-specific counts are by design the review list, not deletions.

**Promoting a rule.** Add the rule to `RULES` and to `AUTO_DROP_RULES` only after re-measuring it
on a larger, re-verified sample. `test/namesake.test.js` fails if an auto-drop rule measures below 95% on
the fixture. Fixture rows are immutable evidence: add rows, do not edit verdicts to fit a rule.

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
