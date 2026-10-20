# Pre-launch backlog

Decisions and work parked for later. Each item says what changes and what is needed to start.

## 1. Privacy policy and terms (legal blocker for an EU launch)
The app collects emails and marketing consent, so GDPR requires a privacy policy before launch.
- **Pages:** `/privacy` and `/terms` in `public/`, English + Spanish, app styling.
- **Links:** "Privacy · Terms" line on the home page and the Account screen; under the sign-up button:
  "By continuing you accept the Terms and Privacy Policy".
- **Self-host the font** (Plus Jakarta Sans) instead of Google Fonts, which sends every visitor's IP to
  Google (ruled a GDPR breach by a German court). No visual change.
- **"Delete my account":** first version = mailto request from Account; automatic deletion needs a
  Supabase Edge Function (later).
- **No cookie banner needed:** no tracking cookies; localStorage is only used for strictly necessary
  functions (session, favourites, event cache).
- **Data the policy must describe:** email (login), optional display name, marketing consent + date,
  preferences (cities, styles, DJs), saved events, onboarding date — stored in Supabase
  (`profiles`, `saved_events`). Profile photo stays on the device. Processors: Supabase (DB + auth),
  Brevo (email), Vercel (hosting + analytics). Third-party content that sees the visitor's IP:
  image hosts (Unsplash, RA, Songkick, Deezer…), jsDelivr (supabase-js).
- **Needed from the founder:** data controller (name or company + tax ID), privacy contact email,
  country. Have a lawyer review the draft.

## 2. Analytics (cookie-free)
- **Code:** one script line in `public/index.html` (Vercel Web Analytics), with query parameters
  stripped before sending (the login token travels in the URL hash, which is never sent). Bump `sw.js`.
- **Founder:** Vercel → project → Analytics → Enable.
- **Collected:** page views, anonymous visitors (request hash, discarded after 24 h), country, device,
  browser, referrer. No cookies, no personal data, no consent banner.
- **Limits:** Hobby plan includes 50,000 events/month (pauses, never bills, when exceeded). Custom
  events (e.g. "Get tickets" clicks) are not available on Hobby — record them in Supabase if needed.
- Sources: https://vercel.com/docs/analytics/privacy-policy · https://vercel.com/docs/analytics/limits-and-pricing

## 3. Brand and domain
`soundmyth.com` is taken (registered 2026-08-11 via Ascio, parked at Loopia). A new name with an
available `.com` is being chosen; renaming touches: `public/index.html` (title, meta, OG tags, copy),
`manifest.webmanifest`, icons/logo, the hardcoded `emailRedirectTo` URL, Supabase Site URL + redirect
allowlist, Brevo sender/domain (SPF/DKIM), Vercel domain, `sitemap.xml`/`robots.txt`, docs.

## 4. Founder reviews (recurring)
- Weekly email: "Likely errors to review" → block wrong ones in `scraper/data/events_block.json`;
  "Suspected namesakes" → same.
- `scraper/data/festivals_candidates.json`: set `status` to `added` (copy row into festivals_all.json)
  or `rejected`.
- `docs/genre-audit-2026-10.md`: ~20 low-confidence DJ styles.
- EDC Colombia: verify https://edccolombia.com (it is not on Resident Advisor).
