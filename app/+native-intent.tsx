/**
 * expo-router native intent hook: runs before routing for every URL the app
 * is opened with (cold start and while running).
 *
 * Turns generic `lightning:<invoice>` links — what every Lightning-aware app
 * and QR code emits — into Starr's own Send route, so Starr can be chosen as
 * the system handler for Lightning payments, not only reached via starr://.
 */
import { lightningUrlToSendPath } from '@/utils/deepLink';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return lightningUrlToSendPath(path);
  } catch {
    return path;
  }
}
