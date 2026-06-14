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
      caps/lowercase/diacritics. Normalize DJ names (NFD strip + canonical casing) when building
      `ALL_DJS` and in the scrapers, and dedupe case-insensitively.
- [ ] **Duplicate events same day** — same event appears twice when the name differs slightly.
      Improve `dedupe.js` (fuzzy name match within same city+date) and/or `source_id` keys.
- [ ] **Missing photos** — events/cards with no image. Review `enrich-images.js` coverage,
      bump `CACHE_VERSION`, add overrides for JS-rendered sites; improve fallbacks.

## Pending — personalization follow-ups
- [ ] Move DJ→genre map to `scraper/data/artists_all.json` + have the scraper stamp
      `events.genre` (durable, covers all DJs, not just the curated ~100).
- [ ] Expand genre coverage beyond the current top-100 map.
- [ ] (Optional) "Festivals for you" — richer lineup/date-range display (e.g. "18–24 Jul").
- [ ] (Optional) Email digests: "a favourite DJ announced a show in your city" (Brevo SMTP).
