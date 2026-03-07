# SoundMyth — Bug Log & Preventive Rules

This file documents every significant bug found in the project, its root cause,
the fix applied, and a rule to avoid repeating it.

---

## BUG-001 · onclick attributes broken when using JSON.stringify
**Status:** Fixed — commit `020ee54` (partial) → `1ff2ccb` (full fix)

**Symptom:** Clicking country / city / DJ / event rows did nothing. No JS error visible.

**Root cause:**
`JSON.stringify("Spain")` returns `"Spain"` with literal double-quote characters.
When embedded inside a double-quoted HTML attribute:
```html
onclick="selectCountry("Spain")"
```
The browser closes the attribute at the first inner `"`, leaving broken JS `selectCountry(`.

**Fix:** Use single quotes for all `onclick` attributes that embed `JSON.stringify()`:
```html
onclick='selectCountry("Spain")'
onclick='openDetail("uuid-here")'
```

**Rule:** Never use double-quote `onclick="..."` when the value contains `JSON.stringify(...)`.
Always use `onclick='...'` for those cases.

---

## BUG-002 · DJ spotlight section invisible when image fails to load
**Status:** Fixed — commit `1ff2ccb`

**Symptom:** The "DJ of the Month" section was completely invisible — no photo, no text.

**Root cause:**
`.dj-spotlight` had no `min-height`. The image had `height:200px`, so the div's height
came entirely from the image. `onerror="this.style.display='none'"` hid the image, collapsing
the div to `height:0`. The text inside was `position:absolute;inset:0` — so with 0 height
on the container, everything disappeared.

**Fix:** Added `min-height:200px; background:#080808;` to `.dj-spotlight`.

**Rule:** Any container whose height depends on a child element that may be hidden/removed
must have an explicit `min-height` if it contains `position:absolute` children.

---

## BUG-003 · Magic link redirected to localhost instead of production
**Status:** Fixed — commit `1ff2ccb` / `5472b85`

**Symptom:** User received the magic link email, clicked it, landed on `localhost:xxxx`
which is not accessible, so login silently failed.

**Root cause:**
```js
emailRedirectTo: location.href   // ← evaluates to whatever URL opened the app
```
If the developer tested locally, `location.href` was `http://localhost:3000`. That URL
was burned into the Supabase token, so clicking the email link sent the user to localhost.

**Fix:** Hardcode the production URL:
```js
emailRedirectTo: 'https://soundmyth.vercel.app'
```

**Rule:** NEVER use `location.href` as `emailRedirectTo`. Always hardcode the production
URL. Store it in a constant at the top of the file:
```js
const SITE_URL = 'https://soundmyth.vercel.app';
```

---

## BUG-004 · Magic link fails when opened in different browser (PKCE cross-browser)
**Status:** Fixed — commit after BUG-003

**Symptom:** Magic link email works in desktop browser but fails when email is opened
in Gmail app / mobile mail client (different from the browser that requested the link).

**Root cause:**
Supabase JS v2 uses **PKCE flow** by default. PKCE generates a `code_verifier` and stores
it in `localStorage` of the browser/tab that called `signInWithOtp`. When the user opens
the email link in a different browser or webview, `localStorage` is empty → code exchange
fails with a cryptic auth error.

**Fix:** Configure the Supabase client to use **implicit flow**:
```js
const sb = supabase.createClient(SB_URL, SB_KEY, {
  auth: { flowType: 'implicit', detectSessionInUrl: true, persistSession: true }
});
```
With implicit flow, the access token arrives directly in the URL hash
(`#access_token=...`) — no code exchange needed, works across any browser.

**Supabase Dashboard step (required — code alone is not enough):**
1. Go to https://supabase.com/dashboard/project/ekcwqesvujqsyuykqtap/auth/url-configuration
2. Set **Site URL** → `https://soundmyth.vercel.app`
3. Add to **Redirect URLs** → `https://soundmyth.vercel.app`
Without this, Supabase rejects the redirect even if the code is correct.

**Rule:** For any SPA (no server-side code), always use `flowType: 'implicit'` in the
Supabase client. PKCE is only safe when the redirect goes back to the same browser session
(e.g., mobile OAuth flows, not magic-link emails).

---

## BUG-005 · Null city / venue crashing toUpperCase()
**Status:** Fixed — commit `1ff2ccb`

**Symptom:** App crashed silently for some events; featured cards and DJ spotlight
failed to render.

**Root cause:**
Bandsintown API returns `null` for `city` and `venue` on some events.
`ev.city.toUpperCase()` threw `TypeError: Cannot read property 'toUpperCase' of null`.

**Fix:** Added null-safe fallbacks in `loadEvents()`:
```js
city: e.city || '',
venue: e.venue || '',
```

**Rule:** Always add `|| ''` fallback when mapping API data fields that are used as
strings later. Treat all API response fields as potentially null/undefined.

---

## BUG-006 · UUID event IDs not quoted in onclick handlers
**Status:** Fixed — commit `020ee54`

**Symptom:** Clicking on event rows in early versions did nothing.

**Root cause:**
```js
onclick="openDetail(${ev.id})"
// Generated: onclick="openDetail(550e8400-e29b-41d4-a716-446655440000)"
// JS sees:   openDetail(550e8400 - e29b - ...)  ← arithmetic, not a string
```

**Fix:** Wrap with `JSON.stringify`:
```js
onclick='openDetail(${JSON.stringify(ev.id)})'
// Generated: onclick='openDetail("550e8400-e29b-41d4-a716-446655440000")'
```

**Rule:** Never interpolate raw UUID/string values directly into onclick JS.
Always use `JSON.stringify()` AND single-quote the attribute.

---

## General Preventive Rules

| # | Rule |
|---|------|
| 1 | Use `onclick='fn(${JSON.stringify(val)})'` — single outer quotes, JSON.stringify for strings |
| 2 | Any div with `position:absolute` children must have explicit `min-height` or `height` |
| 3 | `emailRedirectTo` must always be the hardcoded production URL, never `location.href` |
| 4 | Supabase SPA auth → always `flowType:'implicit'` |
| 5 | Supabase URL allowlist must include production domain (do in dashboard on first deploy) |
| 6 | All API string fields used as `.method()` targets need `|| ''` fallback |
| 7 | Run a Spanish-string grep after any UI translation: `grep -n "VOLVER\|ENVIAR\|GUARDAR\|CANCELAR\|CERRAR"` |
