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
  - [ ] Durability: also normalize at the scraper level so the DB itself is clean.
- [x] **Duplicate events same day** — **Frontend (done)**: `dedupeEvents` in `loadEvents`
      collapses same city+date+normalized-name (+ a "bare artist" pass), validated removing 39
      real dups with no false merges.
  - [ ] Durability: port the same logic into `dedupe.js` so the DB is clean for all consumers.
- [x] **Missing photos** — **Frontend (done)**: `bestImg` reuses an artist's real photo
      (`DJ_IMG`) on their image-less events → recovered 478/560 (85%).
  - [ ] Remaining ~82 + non-artist events: improve `enrich-images.js` coverage (esp. Bandsintown),
        bump `CACHE_VERSION`, add overrides for JS-rendered sites.

- [x] **City names** — **Frontend (done)**: `canonCity` (CITY_ALIAS) folds aliases &
      local-script names into one recognizable name (Eivissa + Ibiza municipalities → Ibiza,
      София→Sofia, İstanbul→Istanbul, 福岡市→Fukuoka, airport/district → city…). Applied in mapRows.
  - [ ] Durability: normalize city in the scrapers; consider a transliteration lib for the
        long tail (Cyrillic/Japanese/Greek) instead of a hand-kept alias map.
- [x] **Garbage venue (venue == name)** — **Frontend (done)**: blanked in mapRows (Bandsintown
      sets the event title as venue); detail falls back to city.
- [x] **Mistagged "festivals"** — **Frontend (done)**: `isFest()` excludes artist club-nights
      that BIT tags as festival (venue==name + ≤1 act, e.g. the weekly "Tomorrowland and Dimitri
      Vegas & Like Mike" in Ibiza) from the Festivals sections.
  - [ ] Durability / root cause: BIT ingestion creates junk events — artist listings titled
        "X and DJ" tagged `festival`, "Tomorrowland Store" (a shop), recurring phantom shows.
        Review `scrape-festivals-bit.js` / `scrape-extended.js`: don't tag as festival unless it
        matches the curated festival list; drop venue==name; filter store/non-event listings.

> Diagnostic tool: `scraper/analyze-quality.mjs` (read-only) quantifies these issues and
> simulates the fixes against live data. Re-run any time to re-measure.

## Pending — personalization follow-ups
- [ ] Move DJ→genre map to `scraper/data/artists_all.json` + have the scraper stamp
      `events.genre` (durable, covers all DJs, not just the curated ~100).
- [ ] Expand genre coverage beyond the current top-100 map.
- [ ] (Optional) "Festivals for you" — richer lineup/date-range display (e.g. "18–24 Jul").
- [ ] (Optional) Email digests: "a favourite DJ announced a show in your city" (Brevo SMTP).
