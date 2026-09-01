/**
 * Wallet session
 *
 * The one owner of the wallet's lifecycle: reading and writing the seed, the
 * lock, starting and stopping Breez, and resetting the wallet store. Screens ask
 * it; none of them touch `KeychainService` or `BreezService.initialize` /
 * `shutdown` themselves. A guard inside one screen can never serialise a process
 * the other screens also drive, which is what kept going wrong.
 *
 * Unlocking IS reading the seed. The entry is stored behind
 * `requireAuthentication`, so the OS refuses it without user presence and getting
 * a value back is the proof — no separate boolean to take on trust. The same read
 * says whether a wallet exists, and its value initialises the wallet.
 *
 * TWO FACTS run the whole thing:
 * - `opInFlight` — a session operation is running. Unlock, create, import and
 *   remove all set it before their first `await`, so none of them can overlap
 *   and `resume()` cannot slip an unlock in between.
 * - `authPending` — an authentication is owed. `lock()` is the only thing that
 *   sets it; every operation clears it as it starts.
 *
 * The second flag does double duty, which is why there is no third one and no
 * generation counter. An operation clears it on entry, so finding it set again
 * after an `await` means exactly one thing: a real background happened while the
 * operation was out. The operation then drops its result — create and import
 * included, since they must not report `open` for a wallet the user backgrounded
 * away from. Mutual exclusion is what makes this unambiguous: with one operation
 * at a time, a boolean says everything a counter would.
 *
 * A cancelled prompt is not a background, so `authPending` stays clear and
 * nothing retries — the Unlock button or the next background is the way on. That
 * is what stops Face ID reopening itself, since the dialog produces
 * inactive → active all by itself.
 */

import { create } from 'zustand';
import {
  KeychainService,
  NoWalletError,
  WalletKeyLostError,
} from '@/services/keychain';
import { BreezService } from '@/services/breez/BreezService';
import { useWalletStore } from './walletStore';

/** What the gate should be showing. The only part screens read. */
export type SessionStatus =
  /** An operation is out, or the first one has not answered yet. */
  | 'checking'
  /** Authentication is required. */
  | 'locked'
  /** Open, or there is no wallet to protect. */
  | 'open';

interface WalletSessionState {
  status: SessionStatus;
  /** Why it is locked, when there is something worth telling the user. */
  message: string | null;
  /** A wipe is running; the gate says so and offers nothing. */
  isRemoving: boolean;

  lock: () => void;
  resume: () => void;
  unlock: () => Promise<void>;
  createWallet: (mnemonic: string) => Promise<void>;
  importWallet: (mnemonic: string) => Promise<void>;
  removeWallet: () => Promise<void>;
}

// Coordination, not UI, so these are module state rather than store state.
let opInFlight = false;
let authPending = true;
let appActive = true;

const readableError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const useWalletSession = create<WalletSessionState>()((set, get) => {
  /** Claims the session for one operation. Called before the first `await`. */
  const begin = () => {
    opInFlight = true;
    authPending = false;
  };

  /**
   * Releases the session and hands over to the authentication a background asked
   * for while the operation was out.
   */
  const settle = () => {
    opInFlight = false;
    if (authPending && appActive && get().status === 'locked') {
      void get().unlock();
    }
  };

  const busy = () => new Error('The wallet is busy. Please try again.');

  /**
   * Leaves the session as the operation found it, for a refusal that happened
   * before anything was changed. Cancelling a removal from Settings must not
   * drop a lock screen over an app that was open — and the caller's alert would
   * end up behind that overlay. A background during the operation still owes an
   * authentication, so it wins over the restored status.
   */
  const abandon = (previous: SessionStatus, message: string) => {
    if (authPending) {
      set({ status: 'locked', message: null });
      return;
    }
    set({
      status: previous,
      message: previous === 'locked' ? message : null,
    });
  };

  return {
    // Starts `checking`: the cold start is covered before the first frame, and
    // the first unlock attempt decides between `locked` and `open`.
    status: 'checking',
    message: null,
    isRemoving: false,

    lock: () => {
      authPending = true;
      appActive = false;
      set({ status: 'locked', message: null });
    },

    resume: () => {
      appActive = true;
      if (authPending && !opInFlight && get().status === 'locked') {
        void get().unlock();
      }
    },

    unlock: async () => {
      if (opInFlight) return;
      begin();
      set({ status: 'checking', message: null });

      try {
        const mnemonic = await KeychainService.getMnemonic();
        if (authPending) return;
        set({ status: 'open', message: null });
        await useWalletStore.getState().initializeWallet(mnemonic);
      } catch (error) {
        if (authPending) return;
        if (error instanceof NoWalletError) {
          // Nothing to protect, and the read never prompted. Onboarding has to
          // be reachable.
          set({ status: 'open', message: null });
          return;
        }
        const message =
          error instanceof WalletKeyLostError ? error.message : readableError(error);
        set({
          status: 'locked',
          // A cancelled prompt speaks for itself.
          message: /cancel/i.test(message) ? null : message,
        });
      } finally {
        settle();
      }
    },

    createWallet: async (mnemonic: string) => {
      if (opInFlight) throw busy();
      begin();
      try {
        await KeychainService.storeMnemonic(mnemonic);
        // Backgrounded while the seed was being written: the wallet exists, but
        // opening it now would skip the authentication that is owed.
        if (authPending) return;
        set({ status: 'open', message: null });
        await useWalletStore.getState().initializeWallet(mnemonic);
      } finally {
        settle();
      }
    },

    importWallet: async (mnemonic: string) => {
      if (!KeychainService.validateMnemonic(mnemonic)) {
        throw new Error('Invalid recovery phrase. Please check your words and try again.');
      }
      if (opInFlight) throw busy();
      begin();
      try {
        // Whatever ran before has to be gone: `initialize` returns early while an
        // SDK is up, so the imported seed would be ignored until a restart.
        await BreezService.shutdown();
        useWalletStore.getState().resetWallet();
        await KeychainService.storeMnemonic(mnemonic);
        if (authPending) return;
        set({ status: 'open', message: null });
        await useWalletStore.getState().initializeWallet(mnemonic);
      } finally {
        settle();
      }
    },

    /**
     * Removes the wallet on this device. Shared by Settings and by the lock
     * screen's way out when the stored key can no longer be read.
     *
     * Navigation is left to the caller: this owns the wallet, not the router.
     */
    removeWallet: async () => {
      if (opInFlight) throw busy();
      // Captured before the operation claims the session, so a refusal can put
      // exactly this back: `open` when asked from Settings, `locked` when asked
      // from the lock screen.
      const previous = get().status;
      begin();
      try {
        let authorized = false;
        try {
          authorized = await KeychainService.authenticateUser(
            'Authenticate to remove this wallet'
          );
        } catch (error) {
          // A native failure is not a refusal, but it is still a reason to
          // remove nothing.
          console.error('[WalletSession] Could not authenticate for removal:', error);
          abandon(previous, readableError(error));
          throw error;
        }
        if (!authorized) {
          const refused = 'You must authenticate to remove your wallet.';
          abandon(previous, refused);
          throw new Error(refused);
        }

        set({ isRemoving: true, message: null });
        try {
          await BreezService.shutdown();
          await KeychainService.clearAllData();
        } catch (error) {
          // Staying locked is the only safe outcome: the seed may still be on
          // the device.
          // Locked whatever the operation came from: the SDK is already down and
          // the seed may still be there, so an unlock is the way back to a
          // working wallet.
          console.error('[WalletSession] Could not remove the wallet:', error);
          set({ status: 'locked', message: readableError(error) });
          throw error;
        } finally {
          set({ isRemoving: false });
        }

        useWalletStore.getState().resetWallet();
        // A background during the wipe still owes an authentication, and the
        // unlock `settle` starts will find no wallet and open onboarding.
        if (authPending) return;
        set({ status: 'open', message: null });
      } finally {
        settle();
      }
    },
  };
});
