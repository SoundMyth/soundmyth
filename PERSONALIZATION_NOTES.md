# Personalization — rollout notes & backlog

Phase 1 (personalized Home + onboarding + cross-device sync) implemented on branch
`feature/personalized-home`. This file tracks what's done and what's pending so we can
pick it up later.

## Done (Phase 1)
- `prefs` state (cities / DJs / genres) in `localStorage` (`sm_prefs`), instant + offline.
- Sync to `public.profiles` on login (`syncPrefs`/`savePrefs`), mirroring the
  `marketing_opt_in` pattern. Saved events already sync via `saved_events`.
- DJ→genre map in `index.html` (top ~100 DJs) so "styles" works client-side now.
- Personalized Home (`#home-personal`): greeting, context hero, For you, Your DJs on tour,
  Festivals for you, In {city}. Marketing hero hidden when personalized.
- Onboarding sheet (cities → styles → DJs, DJs suggested by chosen styles), skippable,
  auto-opens after login. Account → "Edit personalization" (chips + pickers + reset).
- Onboarding/picker action buttons made **sticky** at the bottom (long lists were forcing
  a full scroll to reach Continue).
- SQL migration: `scraper/sql/personalization.sql` (profiles pref columns + RLS).

## Pending — data quality (fix in the production data/pipeline, post-launch)
- [ ] **Duplicate DJs by case / accents** — e.g. same artist listed as different names due to
      caps/lowercase/diacritics.
  - [x] **Frontend (done)** — DJ names canonicalized at load (`buildDjCanon`/`canonDJ` in
        `mapRows`); 104 duplicate spellings collapsed. Matching is case/diacritic-insensitive.
  - [x] **Pipeline (done)** — `scraper/normalize.js` exposes `buildDjCanon`/`djNorm`; `cleanup-junk.js`
        rebuilds canonical DJ spellings from the DB and updates rows (validated: ~94 DJs, ~345 rows).
- [x] **Duplicate events same day** — **Frontend (done)**: `dedupeEvents` in `loadEvents`
      collapses same city+date+normalized-name (+ a "bare artist" pass), validated removing 39
      real dups with no false merges.
  - [x] Pipeline: `dedupe.js` already dedupes by venue/date + fuzzy-venue + festival consolidation
        + consecutive-day (more thorough than the frontend). The residual "bare artist" case is
        masked by the frontend; not porting (no added value, would risk a working multi-pass script).
- [x] **Missing photos** — **Frontend (done)**: `bestImg` reuses an artist's real photo
      (`DJ_IMG`) on their image-less events → recovered 478/560 (85%).
  - [ ] Future (not user-visible; frontend already covers it): improve `enrich-images.js` to write
        real `img_url` for the ~82 remaining + non-artist events (esp. Bandsintown); bump `CACHE_VERSION`.

- [x] **City names** — **Frontend (done)**: `canonCity` (CITY_ALIAS) folds aliases &
      local-script names into one recognizable name (Eivissa + Ibiza municipalities → Ibiza,
      София→Sofia, İstanbul→Istanbul, 福岡市→Fukuoka, airport/district → city…). Applied in mapRows.
  - [x] Durability (done): city normalized in every scraper via shared `scraper/normalize.js`
        (`cleanEvent`). Future: a transliteration lib for the long tail; rows not re-scraped keep
        their old city until the next scrape (the frontend masks it meanwhile).
- [x] **Garbage venue (venue == name)** — **Frontend + pipeline (done)**: blanked in `mapRows`
      and in all scrapers (`cleanEvent`); event detail falls back to city.
- [x] **Mistagged "festivals"** — **Frontend (done)**: `isFest()` excludes artist club-nights
      that BIT tags as festival (venue==name + ≤1 act, e.g. the weekly "Tomorrowland and Dimitri
      Vegas & Like Mike" in Ibiza) from the Festivals sections.
  - [x] Durability (done): `scrape-festivals-bit.js` SKIPS bare artist listings (venue==name + ≤1
        act) at the source; `scraper/cleanup-junk.js` (wired into the workflow after dedupe) deletes
        pre-existing junk rows (festival-tagged with venue==name+≤1 act, or "Store" listings).
        Takes effect on the next scrape run.

> Backlog status: all data-quality items above are addressed (frontend + pipeline). The only
> remaining future nice-to-haves are (a) richer `enrich-images.js` coverage and (b) an automatic
> transliteration lib for brand-new non-Latin cities — the current alias map covers all existing ones.

> Diagnostic tool: `scraper/analyze-quality.mjs` (read-only) quantifies these issues and
> simulates the fixes against live data. Re-run any time to re-measure.

## Pending — personalization follow-ups
- [ ] Move DJ→genre map to `scraper/data/artists_all.json` + have the scraper stamp
      `events.genre` (durable, covers all DJs, not just the curated ~100).
- [ ] Expand genre coverage beyond the current top-100 map.
- [ ] (Optional) "Festivals for you" — richer lineup/date-range display (e.g. "18–24 Jul").
- [ ] (Optional) Email digests: "a favourite DJ announced a show in your city" (Brevo SMTP).
