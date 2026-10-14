/**
 * Deep-link helpers for payments another app hands to Starr.
 *
 * Supported incoming URLs:
 *   starr://send?invoice=<bolt11|lnurl|address>[&<return>]
 *   lightning:<bolt11|lnurl|address>[?<return>]
 *   lightning://<...>            (some apps add the slashes)
 *   bitcoin:<BIP 21 / BIP 321 URI>[&<return>]   (the Breez SDK parses it)
 *
 * <return> is `pop` or `returnUrl`: a percent-encoded URI that
 * Starr opens after the payment (BIP 321 proof of payment). It lets the calling
 * app (e.g. a Nostr client sending a zap) come back to the foreground.
 */

import Constants from 'expo-constants';
import type { SendRequest } from '@/types/wallet';

const RETURN_URL_SCHEME = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;

// Schemes we will never hand to Linking.openURL from a third-party parameter.
// The schemes of Starr also come from app.json, so that a new one is blocked too.
const BLOCKED_RETURN_SCHEMES = new Set([
  'javascript', 'file', 'data', 'blob', 'content', 'intent',
  'tel', 'telprompt', 'sms', 'smsto', 'mmsto', 'mailto',
  'facetime', 'facetime-audio', 'facetime-prompt', 'facetime-audio-prompt',
  'itms-services', 'itms-apps', 'app-settings', 'shortcuts',
  'starr', 'lightning', 'bitcoin',
  ...[Constants.expoConfig?.scheme ?? []].flat().map((scheme) => scheme.toLowerCase()),
]);

/**
 * A return URL supplied by another app, or null when it is not safe to open.
 * Any app scheme (nostrage://, damus://, https://…) is fine; what we refuse is
 * anything that could execute code, read local files, start a system action
 * (call, message, app install, settings, automation), or loop back into Starr.
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

// RFC 3986 percent-decoding, once. URLSearchParams also turns `+` into a
// space, which would change a percent-encoded return URL. BIP 321 keys are
// case-insensitive; the first of a repeated key is used.
function parseQuery(query: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const key = (eq === -1 ? pair : pair.slice(0, eq)).toLowerCase();
    if (!(key in params)) params[key] = safeDecode(eq === -1 ? '' : pair.slice(eq + 1));
  }
  return params;
}

/** The payment request in a payment URL, or null for any other URL. */
export function parseSendLink(url: string): SendRequest | null {
  const [link] = url.trim().split('#');
  const q = link.indexOf('?');
  const head = q === -1 ? link : link.slice(0, q);
  const params = parseQuery(q === -1 ? '' : link.slice(q + 1));
  const colon = head.indexOf(':');
  const scheme = head.slice(0, colon).toLowerCase();
  // Some apps add `//` after the scheme.
  const body = head.slice(colon + 1).replace(/^\/+/, '');

  let invoice: string;
  if (scheme === 'lightning') invoice = safeDecode(body);
  else if (scheme === 'bitcoin') invoice = link;
  else if (scheme === 'starr' && /^send\/?$/i.test(body)) invoice = params.invoice ?? '';
  else return null;

  const returnUrl = safeReturnUrl(params.pop ?? params.returnurl);
  return returnUrl ? { invoice, returnUrl } : { invoice };
}
