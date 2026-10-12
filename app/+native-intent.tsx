/**
 * expo-router native intent hook: runs before routing for every URL the app
 * is opened with (cold start and while running).
 *
 * Turns generic `lightning:<invoice>` links — what every Lightning-aware app
 * and QR code emits — into Starr's own Send route, so Starr can be chosen as
 * the system handler for Lightning payments, not only reached via starr://.
 */
import { lightningUrlToSendPath } from '@/utils/deepLink';

const SEND_WITH_QUERY = /^(starr:\/\/|\/)send\?/i;

// Send is a single screen (see app/_layout.tsx), so a repeat of the same link
// would arrive with unchanged params and be ignored. Tagging each link makes
// the Send screen apply it again.
let linkCount = 0;

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  let next = path;
  try {
    next = lightningUrlToSendPath(path);
  } catch {
    return path;
  }
  return SEND_WITH_QUERY.test(next) ? `${next}&link=${++linkCount}` : next;
}
