/**
 * SoundMyth – shared HTTP helpers
 *
 * Used by every scraper that talks to Songkick or writes to Supabase.
 */

/**
 * Headers for ALL Songkick requests.
 *
 * Songkick's WAF answers 406 with an empty body to requests that claim to be a
 * browser (any Chrome User-Agent + browser Accept header) but lack a real
 * browser's TLS fingerprint — which is every request Node's fetch can make.
 * An honest curl-style UA is served normally. Do NOT "improve" this back into a
 * Chrome User-Agent: that silently zeroes out every Songkick-sourced event.
 * Verified 2026-09-13: Chrome UA -> 406 len=0, curl UA -> 200 len=188327.
 */
export const SK_HEADERS = {
  'User-Agent': 'curl/8.4.0',
  'Accept': '*/*',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Retry a Supabase call on transient network failures.
 * Handles both thrown errors (TypeError: fetch failed) and returned { error }.
 * Returns the last result/error if every attempt fails.
 */
export async function withRetry(fn, label, maxRetries = 3, baseMs = 1000) {
  let lastErr;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      if (!result?.error) return result;
      lastErr = result.error;
    } catch (err) {
      lastErr = err;
    }
    if (attempt < maxRetries) {
      const wait = baseMs * attempt;
      console.warn(`\n  ⚠  ${label} failed (attempt ${attempt}/${maxRetries}): ${lastErr?.message || lastErr}. Retrying in ${wait}ms…`);
      await sleep(wait);
    }
  }
  return { error: lastErr };
}
