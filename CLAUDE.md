# CLAUDE.md

Guidance for AI sessions in this repository. Keep this file short and true. Detail lives in `docs/`.

## What this is

SoundMyth: a mobile-first webapp of upcoming EDM events, live at soundmyth.vercel.app.
Two halves that meet only at the Supabase `events` table and at `public/data/artists.json`:

1. **Frontend**: `index.html`, one self-contained file (inline CSS and one script, vanilla JS, no build). Served as static files from `public/` by Vercel (`vercel.json` sets `outputDirectory`).
2. **Pipeline**: `scraper/`, Node ESM. Runs weekly on GitHub Actions, writes `events` with the Supabase service key, and commits refreshed JSON back to the repo.

The frontend never imports scraper code. The row shape of `events` is the contract.

Root `../CLAUDE.md` (outside git) only says this folder is the project. Ignore `../_archive/`.

## Commands

```bash
# Frontend: no build. Serve public/ statically.
npx serve public --listen 3000   # or: cd public && python -m http.server 3000

# Scraper (run from scraper/)
npm ci
npm run check                    # node --check + import/path/workflow resolution
npm test                         # node --test (lib, steps, tools, data invariants)
npm run step:<name>              # one pipeline step, e.g. step:dedupe
```

There is no frontend test suite. `test/maps-sync.test.js` checks the frontend lookup tables against the scraper.

## Pipeline

`.github/workflows/weekly-scrape.yml` runs `scraper/steps/01-…` to `17-…` in that order. The order matters:

`01 enrich-songkick-urls → 02 scrape-extended → 03 discover-festivals → 04 scrape-festivals-bit → 05 scrape-festivals-direct → 06 scrape-festivals-ra → 07 enrich-clubs-ra → 08 scrape-clubs-ra → 09 dedupe → 10 discover-djs → 11 cleanup-junk → 12 validate → 13 classify → 14 enrich-images → 15 build-artists → 16 purge → commit → verify → 17 report`

- `09-dedupe` must run after every scrape (see invariants).
- `11-cleanup-junk` and `16-purge` **delete** events. `12-validate` deletes only the `events_block.json` list (plus any namesake rule enabled in `lib/namesake.js`; none today). `16-purge` is the only step that deletes by date.
- `cleanup-db.yml` runs `10` and `11` on demand. `keepalive.yml` pings Supabase every second day.

Full runbook, data-file kinds and manual tasks: [docs/OPERATIONS.md](docs/OPERATIONS.md).

## Environment

Steps read `scraper/.env` locally, or GitHub secrets in CI:
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (service role, writes events and bypasses RLS)
- `SUPABASE_ANON_KEY` (read-only steps 03 and 10)
- `BIT_APP_ID` (Bandsintown, step 02 and 04)
- Optional: `BREVO_API_KEY`, `NOTIFY_EMAIL`, `NOTIFY_FROM` (report email), `THEAUDIODB_KEY`, `DJ_TIME_BUDGET_MIN`

Never commit `.env` or any key.

## Frontend invariants (`public/index.html`)

- **Two Supabase clients.** `sb` (auth, implicit flow, persists session) is for auth and per-user rows only. `sbPublic` (no session) reads events. Event loading must never depend on auth state.
- **Magic-link login** uses `signInWithOtp` with `emailRedirectTo` hard-coded to `https://soundmyth.vercel.app`, never `location.href`. `flowType` stays `'implicit'`. Both rules come from real outages (BUG-003, BUG-004).
- `loadEvents()` pages `events` in 1000-row pages with retry, maps rows to the in-memory shape, and caches future events in `localStorage` (`sm_events_cache`) for offline use.
- Local state is in module-level `let`s, persisted under `sm_*` keys.
- Layout is a 430px mobile shell. Tabs are show/hide `div`s toggled by `switchTab()`.
- Every `render*()` for a home section runs independently: wrap, and never call one section from inside another without try/catch.
- Hand-kept tables that must match the scraper: `TOP100_DJS` (mirror of `scraper/data/artists_top100.json`), `CITY_ALIAS_RAW` (mirror of `scraper/lib/normalize.js`), `FLAGS` and `COUNTRY_ISO` (country names and ISO codes). Edit both sides; the test catches drift for `CITY_ALIAS_RAW` only.

## Data invariants (`events`)

- `source_id` is the idempotency key. It **includes the city** when the same event can occur in several cities. A scraper touches only its own `source_id` rows and never deletes by date.
- Festival events from Bandsintown arrive fragmented per DJ. Dedupe consolidates them. Dedupe merges lineups and never removes a DJ. Double-booking detection (Pass 6) only writes `scraper/data/conflicts.json`; an event leaves the database for a double booking only when a person lists its `source_id` in `scraper/data/events_block.json` (step 12).
- Partial loads never drive deletes: `fetchAllRows` returns an error, and cleanup, dedupe and classify abort on it.
- Dates are calendar dates. Never derive a date with `toISOString()` from an offset timestamp.
- Events are kept 8 days in the past (`16-purge.js`). The frontend greys out the last 7.
- Genre and tags come from the canonical 16-style taxonomy in `scraper/lib/genres.js`. An event with no known DJ or festival style is `Multi-genre`.
- **Songkick namesakes are review-only.** Songkick merges same-name acts into one artist page. Step 12 deletes a namesake only through `AUTO_DROP_RULES` in `scraper/lib/namesake.js`, which is empty: no rule reached 95% on the 2026-10 audit. Suspected ones go to the weekly email; `scraper/data/events_allow.json` rescues one. See [docs/OPERATIONS.md](docs/OPERATIONS.md) "Namesakes".

Full rules with their incidents: [docs/BUGS.md](docs/BUGS.md).

## Conventions

- **Quoting in `onclick`:** single outer quotes around `JSON.stringify`: `onclick='openDetail(${JSON.stringify(id)})'`.
- **Escaping:** scraped text rendered into `innerHTML` goes through `esc()`.
- **Nulls:** every API string used with a method has a `|| ''` fallback, and `FLAGS[c] || '🌍'`.
- **Inputs:** `font-size: 16px` or more, and `touch-action: manipulation` on `*`, to stop iOS zoom.
- **Normalisation for matching:** NFD-fold diacritics before any ASCII regex.
- **Scraper modules:** shared code goes in `scraper/lib/` (`db.js` for Supabase, env and paging; `ra.js` for the Resident Advisor transport; `http.js`; `normalize.js`; `genres.js`; `conflicts.js` for double-booking detection and the block list; `run-stats.js`). Steps and tools import from `lib/`, and read data with `resolve(__dirname, '../data/…')`.
- **Layout rules** (enforced by `test/imports.test.js`): every `steps/NN-*.js` is run by `weekly-scrape.yml`, no `tools/*` file is run by CI, and every `lib/*.js` is imported somewhere.
- **Bumping caches:** `DJ_CACHE_VERSION` or `FEST_CACHE_VERSION` in `steps/14-enrich-images.js` when lookup logic changes. `CACHE` in `sw.js` when the app shell changes.
- **Commits:** small and logically separate. The workflow file must stay valid YAML.

## File map

| Path | Role |
|---|---|
| `public/` | Everything Vercel serves (see `vercel.json`): the site's URLs map 1:1 to this folder |
| `public/index.html` | Frontend (production) |
| `public/sw.js`, `manifest.webmanifest`, `favicon.svg`, `icon-*.png`, `apple-touch-icon.png`, `robots.txt`, `sitemap.xml` | PWA and SEO |
| `public/data/artists.json` | DJ artifact served to the frontend at `/data/artists.json` (built by step 15) |
| `vercel.json` | Deploy config: serve `public/` |
| `scraper/steps/` | The 17 pipeline steps, in run order |
| `scraper/lib/` | Shared modules: `db.js`, `ra.js`, `http.js`, `normalize.js`, `genres.js`, `run-stats.js` |
| `scraper/tools/` | Manual scripts, never run by CI: `check.js`, `static-scan.js`, `promote-candidates.js`, `infer-styles.js`, `analyze-quality.mjs`, `enrich-festivals-*.js` |
| `scraper/data/` | Curated lists, caches and run outputs. Kinds are documented in docs/OPERATIONS.md |
| `scraper/sql/` | One-off Supabase SQL (`harden-rls.sql`, `personalization.sql`) |
| `scraper/test/` | `node --test` suites |
| `.github/workflows/` | `weekly-scrape.yml`, `cleanup-db.yml`, `keepalive.yml`, `ci.yml` |
| `docs/` | Runbook, rules and incidents, personalization backlog, genre audit, Supabase email template |
| `design/` | Event-detail prototype and icon source artwork. Not served |

## Reference

- [README.md](README.md): overview for people
- [docs/OPERATIONS.md](docs/OPERATIONS.md): pipeline, data files, how-tos
- [docs/BUGS.md](docs/BUGS.md): rules and incident log. Read before non-trivial changes
- [docs/PERSONALIZATION_NOTES.md](docs/PERSONALIZATION_NOTES.md): personalization backlog
- [docs/genre-audit-2026-10.md](docs/genre-audit-2026-10.md): genre reclassification audit
