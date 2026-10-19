# Rules and incident log

Two parts. **Rules** are what to check before changing an area; each one cites the
incident that taught it. **Incidents** is the history, one entry per bug, with its
root cause in a line. The full write-ups for BUG-001 to BUG-019 are in git history
(`git log --follow -p -- docs/BUGS.md`).

## Rules

### Frontend (`web/index.html`)
- **R1 onclick quoting.** Use single outer quotes with JSON.stringify inside:
  `onclick='openDetail(${JSON.stringify(id)})'`. A double-quoted attribute breaks at the first inner `"`. Escape scraped text rendered with `innerHTML` through `esc()`. (BUG-001, BUG-006)
- **R2 Magic-link redirect is hard-coded.** `emailRedirectTo` is the hard-coded production URL (`https://soundmyth.vercel.app`), never `location.href`. (BUG-003)
- **R3 Implicit flow only.** The auth client uses `flowType: 'implicit'`. PKCE breaks when the link opens in another browser. (BUG-004)
- **R4 Two Supabase clients, on purpose.** `sb` is for auth and per-user rows. `sbPublic` (no session) reads events, so event loading never depends on auth state.
- **R5 Collapsing containers.** A container whose height comes from a child that can be hidden needs an explicit `min-height` when it holds `position:absolute` children. (BUG-002)
- **R6 iOS zoom.** Every `input`, `select` and `textarea` is at least 16px, and `touch-action: manipulation` is set on `*`. The viewport meta tag is ignored by iOS. (BUG-009, BUG-018)
- **R7 Sections render independently.** Never call one `render*()` from inside another without try/catch. (BUG-008)
- **R8 Null-safe API fields.** Fallback every API string used with a method (`|| ''`), and `FLAGS[c] || '🌍'`. (BUG-005, BUG-010)
- **R9 Lookup tables in sync.** `TOP100_DJS` mirrors `scraper/data/artists_top100.json`. `CITY_ALIAS_RAW` is mirrored in `scraper/lib/normalize.js`. `test/maps-sync.test.js` fails on drift. Edit both sides.
- **R10 Spanish leftovers.** After a translation pass, grep for Spanish strings in UI text and alerts.
- **R11 Service worker.** Bump `CACHE` in `sw.js` (currently `soundmyth-v6`) whenever the shell changes. `/data/artists.json` is network-first.

### Scraper and data
- **R12 Dedupe runs after every scrape.** BIT returns festivals fragmented per DJ, and only dedupe consolidates them. (BUG-007, BUG-019)
- **R13 `source_id` carries the city** when an event can happen in several cities. Formula: source + name + city + date or year. (BUG-012)
- **R14 Only `purge.js` deletes by date.** Other steps delete or update their own rows only. (BUG-013)
- **R15 Partial loads never drive deletes.** `fetchAllRows` returns the error. Cleanup, dedupe and classify abort on it. Validate continues with partial rows, by design.
- **R16 Dedupe merges lineups, never removes DJs or events for double bookings.** A false extra DJ is better than a missing one. Pass 6 only detects and writes `conflicts.json`. An event leaves the database for a double booking only when a person lists its `source_id` in `events_block.json` (step 12). Festival-like events are never conflicts. (INC-2026-10-18; rule 16 in the original list)
- **R17 Normalise before stripping marks.** `.normalize('NFD').replace(/[̀-ͯ]/g, '')` first, then ASCII regexes. (BUG-011)
- **R18 Name lookups use variants and identity checks.** Strip "(official)", "DJ ", "The ". Accept a Wikipedia or Deezer photo only when the title or name matches exactly. (BUG-014, BUG-016)
- **R19 Country codes map in both places.** Every ISO code a scraper returns must resolve in `COUNTRY_ISO` (frontend) and `canonCountry` (`lib/normalize.js`). (BUG-017)
- **R20 Dates are calendar dates.** Never derive a date with `toISOString()` on an offset timestamp (the +1 day bug). Yearless dates roll to next year if more than 30 days past.
- **R21 Retention is 8 days.** `purge.js` keeps 8 past days; the frontend shows the last 7 greyed out.
- **R22 Hub city vs country.** A city that appears under another country is corrected only with venue evidence in `clubs_all.json`; otherwise it is flagged in the report.
- **R23 Songkick needs its curl User-Agent.** Browser-like UAs get HTTP 406 with an empty body from Node's fetch, and every Songkick event silently disappears. Keep `SK_HEADERS` in `lib/http.js`. (Verified 2026-09-13.)
- **R24 RA throttles with HTTP 200 and empty results.** An empty search is trusted only after a canary artist confirms RA answers. Otherwise the result is "unknown", not "not on RA". (`steps/10-discover-djs.js`)
- **R25 Festival images for JS-rendered sites.** Tomorrowland and EDC return no og:image to a static fetch. Add them to `FESTIVAL_IMAGE_OVERRIDES`.
- **R26 Cache versions.** Bump `DJ_CACHE_VERSION` (or `FEST_CACHE_VERSION`) when lookup logic improves, so previous failures retry.
- **R27 Keep the project awake.** The free Supabase tier pauses after 7 days idle. `keepalive.yml` runs every second day. (Incident 2026-09-20)

## Incidents

| ID | When | Symptom | Root cause | Fix / rule |
|---|---|---|---|---|
| BUG-001 | early | Clicking rows did nothing | `JSON.stringify` inside a double-quoted attribute | R1 |
| BUG-002 | early | DJ spotlight invisible when its image failed | Absolutely positioned children in a zero-height box | R5 |
| BUG-003 | early | Magic link opened localhost | `emailRedirectTo: location.href` | R2 |
| BUG-004 | early | Magic link failed in another browser | PKCE verifier lives in the requesting browser | R3 |
| BUG-005 | early | Featured cards crashed | Null `city` / `venue` from the API | R8 |
| BUG-006 | early | Event rows did nothing | Unquoted UUID in onclick (parsed as arithmetic) | R1 |
| BUG-007 | early | Coachella showed one DJ | BIT creates one event per DJ; dedupe missed festival groups | Festival consolidation; R12 |
| BUG-008 | early | Festivals and clubs sections empty | A crash in Highlights stopped the render chain | R7 |
| BUG-009 | early | iOS zoom on search | Input font-size 13px | R6 |
| BUG-010 | early | Missing flags (Taiwan, Vietnam, UK…) | Incomplete `FLAGS` / `COUNTRY_ISO` | R8, R19 |
| BUG-011 | early | Ushuaïa and Ushuaia not merged | Regex stripped diacritics instead of folding them | R17 |
| BUG-012 | early | Time Warp editions overwrote each other | `source_id` lacked the city | R13 |
| BUG-013 | early | Yesterday's events vanished | A scraper ran an inline date purge | R14 |
| BUG-014 | early | Famous DJs without photos | Exact-name lookups; no variants | R18 |
| BUG-015 | early | No festival photos for JS sites | Static fetch cannot see JS-rendered meta tags | R25 |
| BUG-016 | early | Wrong DJ photos (five DJs shared one) | Wikipedia results accepted without a title check | R18 |
| BUG-017 | early | "USA" and "United States" as two countries | Incomplete ISO and alias maps | R19 |
| BUG-018 | early | iOS zoom still happening | Class-specific font-size only; iOS ignores the viewport meta tag | R6 |
| BUG-019 | early | One DJ's residency listed as separate nights | No consecutive-day merge | Dedupe pass 4 |
| INC-2026-09-20 | Sep 2026 | Scraper "fetch failed" for 11 days | Workflow bug stopped the weekly run; Supabase paused the project | R27 (keepalive) |
| INC-2026-10 | Oct 2026 | Prime Club listed in "Amsterdam, NY" | Songkick hub city with a wrong country | R22 (venue evidence in `clubs_all.json`) |
| INC-2026-10 | Oct 2026 | Festival curation wiped | Legacy `import-datalake.js` regenerated `festivals_all.json` from a spreadsheet | Script retired (archived); `festivals_all.json` is curated by hand |
| INC-2026-10-18 | Oct 2026 | Pass 6 deleted about 140 legitimate shows in one weekly run: festival-day slots and same-country double-headers, plus some real cross-country pairs | Songkick dates each festival appearance with the festival's first day, so a DJ playing day 1 of a festival and a club elsewhere that day looked like a double booking. Two real shows in one country on one day matched too. Pass 6 deleted or stripped on guesswork, with no way to know which side was wrong | R16: Pass 6 is detection only. Festival-like events are excluded. Review by hand through `events_block.json`. Tests: `test/conflicts.test.js` (regression on the snapshot) |
| INC-2026-10 | Oct 2026 | DJ candidates wrongly dropped on RA throttling risk | RA answers throttled requests with HTTP 200 and an empty list, which looks like "not on RA" | R24 (canary check in `steps/10-discover-djs.js`) |
