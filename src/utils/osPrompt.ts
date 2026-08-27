/**
 * OS prompt guard
 *
 * Marks the periods when the app itself opens a system dialog: a permission
 * request or a biometric prompt. AuthGate must not read these as the user
 * leaving the app.
 *
 * Android needs this. AppStateModule reports only `active` and `background`,
 * and a permission dialog is a separate activity that pauses ours, so
 * `onHostPause` arrives as `background`. LifecycleEventListener has no
 * `onHostStop`, and `onUserLeaveHint` never reaches JS, so JS alone cannot
 * tell a system dialog from a real background.
 *
 * State is module-level, not React state: AuthGate reads it inside a
 * synchronous AppState handler.
 */

/**
 * A dialog that stays open longer than this counts as closed. A promise that
 * never settles must not keep the wallet unlockable.
 */
const MAX_MS = 60_000;

let depth = 0;
let expiresAt = 0;

/** True while the app itself shows a system dialog. */
export function isOsPromptActive(): boolean {
  if (depth === 0) {
    return false;
  }
  if (Date.now() > expiresAt) {
    depth = 0;
    return false;
  }
  return true;
}

/**
 * Runs `fn` and reports an open system dialog while it is pending.
 *
 * The depth counter keeps this correct when two screens prompt at the same
 * time: the guard clears only after the last one settles.
 */
export async function runOsPrompt<T>(fn: () => Promise<T>): Promise<T> {
  depth += 1;
  expiresAt = Date.now() + MAX_MS;
  try {
    return await fn();
  } finally {
    depth = Math.max(0, depth - 1);
  }
}
