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
  - [x] Pipeline (done): `enrich-images.js` now looks up the first 3 acts of each line-up (not just
        `djs[0]`) so an event still gets a photo when the headliner isn't on TheAudioDB/Wikipedia but a
        co-act is; `CACHE_VERSION` bumped to 4 to retry past failures. Takes effect on the next scrape.

- [x] **City names** — **Frontend (done)**: `canonCity` (CITY_ALIAS) folds aliases &
      local-script names into one recognizable name (Eivissa + Ibiza municipalities → Ibiza,
      София→Sofia, İstanbul→Istanbul, 福岡市→Fukuoka, airport/district → city…). Applied in mapRows.
  - [x] Durability (done): city normalized in every scraper via shared `scraper/normalize.js`
        (`cleanEvent`). `canonCity` now also auto-transliterates Latin-Extended / non-Latin scripts
        via the `transliteration` package (София→Sofiya, Wrocław→Wroclaw, new Чебоксары→Cheboksary),
        keeping Latin-1 accents (Zürich, Málaga). `cleanup-junk.js` re-canonicalizes existing rows.
- [x] **Garbage venue (venue == name)** — **Frontend + pipeline (done)**: blanked in `mapRows`
      and in all scrapers (`cleanEvent`); event detail falls back to city.
- [x] **Mistagged "festivals"** — **Frontend (done)**: `isFest()` excludes artist club-nights
      that BIT tags as festival (venue==name + ≤1 act, e.g. the weekly "Tomorrowland and Dimitri
      Vegas & Like Mike" in Ibiza) from the Festivals sections.
  - [x] Durability (done): `scrape-festivals-bit.js` SKIPS bare artist listings (venue==name + ≤1
        act) at the source; `scraper/cleanup-junk.js` (wired into the workflow after dedupe) deletes
        pre-existing junk rows (festival-tagged with venue==name+≤1 act, or "Store" listings).
        Takes effect on the next scrape run.

> Backlog status: **all items done** (frontend + pipeline), including the two former nice-to-haves
> (richer image coverage + automatic transliteration of non-Latin cities). Self-maintaining via the
> weekly workflow + the on-demand "Clean DB" workflow.

## Deep-review hardening pass (done)
- [x] **Stored XSS** — `esc()` applied to all scraped text rendered into `innerHTML`; onclick
      string args hardened with `esc(JSON.stringify(...))`.
- [x] **RLS** — `scraper/sql/harden-rls.sql` (run in Supabase): `events` read-only for anon,
      `saved_events`/`profiles` per-user; writes only via service key. Verified live.
- [x] **Perf** — `loadEvents` selects only mapped columns (no `select('*')`).
- [x] **Tests** — `scraper/test/*` (`npm test` → `node --test`), incl. a test that fails if the
      `CITY_ALIAS_RAW` map drifts between `index.html` and `scraper/normalize.js` (covers the
      duplication risk without a shared-module refactor).
- [x] **SEO/social** — meta description, Open Graph + Twitter cards, canonical, theme-color,
      `favicon.svg`, `robots.txt`, `sitemap.xml`.
- [x] **PWA** — `manifest.webmanifest` + `sw.js` (network-first shell, cache-first static, offline).
- [x] **A11y** — viewport allows pinch-zoom again; `aria-label`s on icon-only save buttons.
- [ ] Remaining a11y refinement (larger, optional): make clickable card/row **divs** real
      keyboard-focusable buttons (`role`/`tabindex`/Enter). Not done — needs a broader markup pass.
- [ ] Optional: real PNG app icons (192/512) for best iOS/Android install fidelity (SVG used now).

> Diagnostic tool: `scraper/analyze-quality.mjs` (read-only) quantifies these issues and
> simulates the fixes against live data. Re-run any time to re-measure.

## Reported bugs — fixed
- [x] **Logout kept showing recommendations** — `doSignOut` now clears `prefs`
      (cities/DJs/genres) + `persistPrefsLocal` and re-renders Home/Account, so a logged-out
      Home shows no personalization (re-login restores prefs from the profile). Saved events
      left as a local convenience (separate concern).
- [x] **DJ profile trapped navigation** — the `#dj-detail` overlay (z-index 210) wasn't closed
      when switching tabs, so the lupa/any nav stayed stuck on the DJ screen. `switchTab` now
      closes `#dj-detail` (then `#detail`) before switching.
- [x] **City grouping by case / nickname** — `canonCity` (frontend + `normalize.js`) now
      Title-cases the ASCII-folded name so caps/hyphen-case variants merge (BOCHUM/Bochum,
      Rio de/De Janeiro, Cluj-napoca/Napoca) and drops trailing UPPERCASE nickname acronyms
      ("New York (NYC)"→New York, "Los Angeles (LA)"→Los Angeles) while keeping lowercase
      disambiguators ("Frankfurt (oder)"). Merged 16 variants live. +2 tests.
  - [ ] **Residual (backlog)**: non-city values still leak into `city` (venue/region/ski-resort
        like "la pinilla", "Theale, Berkshire", "Cheshire, Daresbury", "Copenhagen Municipality",
        "Praha 9"). Needs a "City, Region"→city rule, a " Municipality/District" strip, and/or a
        small non-city blocklist — deferred (long-tail, low count).

## Pending — personalization follow-ups
- [ ] Move DJ→genre map to `scraper/data/artists_all.json` + have the scraper stamp
      `events.genre` (durable, covers all DJs, not just the curated ~100).
- [ ] Expand genre coverage beyond the current top-100 map.
- [ ] (Optional) "Festivals for you" — richer lineup/date-range display (e.g. "18–24 Jul").
- [ ] (Optional) Email digests: "a favourite DJ announced a show in your city" (Brevo SMTP).
