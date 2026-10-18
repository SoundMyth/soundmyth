/**
 * SoundMyth – Resident Advisor GraphQL transport (https://ra.co/graphql, no API key).
 *
 * Only the transport is shared. Retry, throttle and error policy stay with each caller
 * on purpose: they differ (e.g. discover-djs treats an empty search as "not on RA" only
 * after a canary check, because RA throttles with HTTP 200 + empty results).
 */

export const RA_GQL = 'https://ra.co/graphql';

export const RA_HEADERS = {
  'Content-Type':    'application/json',
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Referer':         'https://ra.co/',
  'Origin':          'https://ra.co',
  'Accept':          'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

/** POST a GraphQL query. Resolves with the fetch Response; rejects on network error or timeout. */
export function raPost(query, variables, { timeoutMs = 15000, headers = RA_HEADERS } = {}) {
  return fetch(RA_GQL, {
    method:  'POST',
    headers,
    body:    JSON.stringify({ query, variables }),
    signal:  AbortSignal.timeout(timeoutMs),
  });
}

/**
 * Data or null. Null on HTTP/network error or on any GraphQL error.
 * Used by the festival lookups, which treat partial GraphQL results as unusable.
 */
export async function raQuery(query, variables, opts) {
  try {
    const res = await raPost(query, variables, opts);
    if (!res.ok) return null;
    const json = await res.json();
    return json?.errors ? null : (json?.data ?? null);
  } catch { return null; }
}
