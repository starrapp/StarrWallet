/**
 * expo-router native intent hook: runs before routing for every URL the app
 * is opened with (cold start and while running).
 *
 * Turns generic `lightning:<invoice>` links — what every Lightning-aware app
 * and QR code emits — into Starr's own Send route, so Starr can be chosen as
 * the system handler for Lightning payments, not only reached via starr://.
 */
import { KeychainService } from '@/services/keychain';
import { openSend, setPendingSend } from '@/stores/sendStore';
import { parseSendLink } from '@/utils/deepLink';
import type { SendRequest } from '@/types/wallet';

// Synchronous where it can be: a promise for the initial URL makes expo-router
// update its state before it mounts.
export function redirectSystemPath(
  { path, initial }: { path: string; initial: boolean },
): string | Promise<null> | null {
  const request = parseSendLink(path);
  // Starr has no other inbound links, and a wallet screen must not open
  // without the wallet check in app/index.tsx.
  if (!request) return initial ? '/' : null;
  if (initial) {
    // Go through app/index.tsx. It checks the wallet and opens Send on top of
    // the tabs.
    setPendingSend(request);
    return '/';
  }
  return openIfWalletExists(request);
}

async function openIfWalletExists(request: SendRequest): Promise<null> {
  // While onboarding runs, there is no wallet to pay from.
  if (await KeychainService.isWalletCreated().catch(() => false)) {
    // The router would only navigate. Open Send here so that the screens that
    // are open close first.
    openSend(request);
  }
  return null;
}
