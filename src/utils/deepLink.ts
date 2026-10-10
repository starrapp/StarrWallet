/**
 * Deep-link helpers for payments another app hands to Starr.
 *
 * Supported incoming URLs:
 *   starr://send?invoice=<bolt11|lnurl|address>[&returnUrl=<url>]
 *   lightning:<bolt11|lnurl|address>[?returnUrl=<url>]
 *   lightning://<...>            (some apps add the slashes)
 *
 * `returnUrl` lets the calling app (e.g. a Nostr client sending a zap) be
 * brought back to the foreground after the payment succeeds.
 */

const RETURN_URL_SCHEME = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;

// Schemes we will never hand to Linking.openURL from a third-party parameter.
const BLOCKED_RETURN_SCHEMES = new Set(['javascript', 'file', 'data', 'blob', 'content', 'intent', 'starr']);

/**
 * A return URL supplied by another app, or null when it is not safe to open.
 * Any app scheme (nostrage://, damus://, https://…) is fine; what we refuse is
 * anything that could execute code, read local files, or loop back into Starr.
 */
export function safeReturnUrl(value?: string | null): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  const scheme = RETURN_URL_SCHEME.exec(raw)?.[1]?.toLowerCase();
  if (!scheme || BLOCKED_RETURN_SCHEMES.has(scheme)) return null;
  return raw;
}

// A stray `%` in a pasted invoice must not drop the link on the floor; the
// Send screen's parser reports anything that is not a valid payload.
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Rewrite a `lightning:` URL into the in-app Send route. Anything that is not
 * a lightning URL is returned unchanged so expo-router handles it normally
 * (e.g. starr://send?… already maps to app/send.tsx).
 */
export function lightningUrlToSendPath(url: string): string {
  const match = /^lightning:(?:\/\/)?(.*)$/i.exec(url.trim());
  if (!match) return url;
  const [payload, query = ''] = match[1].split('?', 2);
  const params = new URLSearchParams(query);
  // Keep any returnUrl the caller added after the invoice.
  const returnUrl = params.get('returnUrl');
  const out = new URLSearchParams({ invoice: safeDecode(payload) });
  if (returnUrl) out.set('returnUrl', returnUrl);
  return `/send?${out.toString()}`;
}
