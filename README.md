# SoundMyth

A mobile-first webapp that lists upcoming EDM events: DJ shows, festivals and club
nights, by country and city. Live at <https://soundmyth.vercel.app>.

## How it fits together

```
 Bandsintown · Songkick · Resident Advisor · festival websites
                         │
                         ▼   weekly GitHub Actions run (Sundays 02:00 UTC)
        scraper/steps/01 … 17   (Node, ESM; lib/ shared code)
                         │
          ┌──────────────┴───────────────┐
          ▼                              ▼
   Supabase `events` table   public/data/artists.json + scraper/data/*.json
          │                              │   (committed back to this repo)
          ▼                              ▼
   public/index.html  ◀── events ──┴── DJ genre and photo ──
   (static, Vercel, no build step)
```

Two halves that only meet at the `events` table and at one JSON artifact. The frontend
never imports scraper code.

## Repository layout

| Path | What |
|---|---|
| `public/` | The website, exactly as Vercel serves it: `index.html` (the whole frontend: inline CSS and one script, no framework, no build), `sw.js`, `manifest.webmanifest`, icons, `robots.txt`, `sitemap.xml` |
| `public/data/artists.json` | DJ artifact built by `scraper/steps/15-build-artists.js`, served at `/data/artists.json` |
| `vercel.json` | Tells Vercel to serve `public/` |
| `scraper/` | The pipeline: `steps/` (run in order), `lib/` (shared), `tools/` (manual), `data/` (curated lists and caches), `sql/`, `test/` |
| `.github/workflows/` | `weekly-scrape.yml` (pipeline), `cleanup-db.yml`, `keepalive.yml`, `ci.yml` |
| `docs/` | Operations runbook, rules and incident log, personalization backlog, genre audit, Supabase email template |
| `design/` | Event-detail prototype and the source artwork for the app icons |

## Run it locally

Frontend (no build):
```bash
npx serve public --listen 3000     # or: cd public && python -m http.server 3000
```
Open <http://localhost:3000>. The app reads Supabase directly, so it shows live data.

Scraper:
```bash
cd scraper
npm ci
npm run check      # syntax, import and path checks over the whole tree
npm test           # unit tests (node --test)
npm run step:dedupe   # run one pipeline step; see `npm run` for the list
```
Steps that write to Supabase need `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in
`scraper/.env` (or the environment). `docs/OPERATIONS.md` has the rest.

## The weekly pipeline

`.github/workflows/weekly-scrape.yml` runs 17 steps in order: enrich Songkick URLs,
scrape DJs, discover and scrape festivals (three sources), enrich and scrape clubs,
deduplicate, discover unlisted DJs, clean junk, validate, classify genres, enrich
images, build the DJ artifact, purge old events, commit the data files, verify, and
email a report. Each step is an independent `node` file, so it can be re-run alone.

Details, data-file kinds and manual tasks are in [docs/OPERATIONS.md](docs/OPERATIONS.md).

## Where to look

- **Working on the app or the pipeline:** [CLAUDE.md](CLAUDE.md) is the map of
  invariants and conventions. Read it first, then [docs/BUGS.md](docs/BUGS.md) before
  non-trivial changes.
- **Running or fixing the weekly job:** [docs/OPERATIONS.md](docs/OPERATIONS.md).
- **Backlog and history of personalization:** [docs/PERSONALIZATION_NOTES.md](docs/PERSONALIZATION_NOTES.md).
- **Genre taxonomy audit (2026-10):** [docs/genre-audit-2026-10.md](docs/genre-audit-2026-10.md).

## Deploy

Vercel serves `public/` as a static site (set in `vercel.json`); every push to `main` deploys. Auth and Supabase settings (site URL,
redirect allowlist, custom SMTP for magic-link emails) are configured in the Supabase
dashboard. The email template is tracked as [docs/email-magic-link.html](docs/email-magic-link.html).
