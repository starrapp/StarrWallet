/**
 * AuthGate
 *
 * Two jobs and no decisions: translate AppState into calls on
 * [walletSession](src/stores/walletSession.ts), and draw the overlay for whatever
 * status that reports. Everything about the seed, the lock and the Breez
 * lifecycle lives in the session, because the same workflow also runs from
 * onboarding, Retry and Settings — a guard here could never cover those.
 *
 * `shielded` is the exception and stays local: the privacy cover for the task
 * switcher is pure UI. `inactive` raises it, `active` drops it, it asks for
 * nothing. The lock is a different thing and only a successful seed read drops
 * it — the biometric dialog itself produces inactive → active, so a cancelled
 * Face ID would otherwise look exactly like returning from a switcher peek.
 *
 * PLATFORMS. A system dialog makes the app leave `active`, which looks the same
 * as the user leaving, and the two report it differently:
 * - iOS gives `inactive` only; a real background also gives `background`, so the
 *   two are distinguishable.
 * - Android has no `inactive` at all (AppStateModule emits only `active` and
 *   `background`, and `onHostPause` maps to `background`), so there they are not.
 *
 * So the app declares its own dialogs: every call that opens one runs inside
 * `runOsPrompt` (see @/utils/osPrompt), and `background` skips the lock while
 * `isOsPromptActive()` holds. KNOWN COST, Android only: a real background while
 * such a dialog is up does not arm the lock. `LifecycleEventListener` has no
 * `onHostStop` and `onUserLeaveHint` never reaches JS, so JS cannot tell them
 * apart; a native module is the only strict fix.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Alert, AppState, Platform, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useWalletSession } from '@/stores/walletSession';
import { isOsPromptActive } from '@/utils/osPrompt';
import { useColors } from '@/contexts';
import { Text, Button } from '@/components/ui';
import { spacing } from '@/theme';

interface AuthGateProps {
  children: React.ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const colors = useColors();
  const router = useRouter();

  const status = useWalletSession((state) => state.status);
  const message = useWalletSession((state) => state.message);
  const isRemoving = useWalletSession((state) => state.isRemoving);
  const lock = useWalletSession((state) => state.lock);
  const resume = useWalletSession((state) => state.resume);
  const unlock = useWalletSession((state) => state.unlock);
  const removeWallet = useWalletSession((state) => state.removeWallet);

  /** Privacy cover for the task switcher. Requires nothing to lift it. */
  const [shielded, setShielded] = useState(false);

  // The cold start is just the first unlock attempt.
  useEffect(() => {
    void unlock();
  }, [unlock]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background') {
        if (Platform.OS === 'android' && isOsPromptActive()) return;
        lock();
        return;
      }

      if (nextState === 'inactive') {
        // A dialog this app opened needs no privacy cover — it would only flash
        // behind it.
        if (!isOsPromptActive()) {
          setShielded(true);
        }
        return;
      }

      if (nextState === 'active') {
        setShielded(false);
        resume();
      }
    });

    return () => subscription.remove();
  }, [lock, resume]);

  /**
   * The way out when the stored key can no longer be read. On iOS the entry sits
   * under `.biometryCurrentSet`, so re-enrolling Face ID destroys it for good and
   * the read is the only way in — without this the user would be locked out.
   */
  const confirmRemove = useCallback(() => {
    Alert.alert(
      'Restore from seed phrase',
      'This removes the wallet stored on this device. You can only get it back with its seed phrase.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove and restore',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeWallet();
              router.replace('/onboarding/import');
            } catch {
              // The session already put the reason on screen and kept the lock.
            }
          },
        },
      ]
    );
  }, [removeWallet, router]);

  // Buttons only while the session waits on the user. During a read or a wipe
  // there is nothing to offer, and the session would refuse anyway.
  const showActions = status === 'locked' && !isRemoving;

  if (status === 'open' && !shielded) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <View style={[styles.overlay, { backgroundColor: colors.background.primary }]}>
        <View style={styles.content}>
          <View style={[styles.logoCircle, { backgroundColor: colors.gold.glow, borderColor: colors.gold.pure }]}>
            <Ionicons name="logo-bitcoin" size={48} color={colors.gold.pure} />
          </View>
          <Text variant="displaySmall" color={colors.text.primary}>
            Starr
          </Text>
          {isRemoving && (
            <Text variant="bodyMedium" color={colors.text.secondary} align="center">
              Removing wallet…
            </Text>
          )}
          {showActions && (
            <Text variant="bodyMedium" color={colors.text.secondary} align="center">
              {message ?? 'Wallet is locked'}
            </Text>
          )}
        </View>
        {showActions && (
          <View style={styles.actions}>
            <Button
              title="Unlock"
              onPress={unlock}
              variant="primary"
              size="lg"
              icon={<Ionicons name="lock-open" size={18} color="#FFFFFF" />}
            />
            <Button
              title="Restore from seed phrase"
              onPress={confirmRemove}
              variant="ghost"
              size="lg"
            />
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 2,
  },
  actions: {
    width: '100%',
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.sm,
  },
});
