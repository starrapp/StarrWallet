/**
 * AuthGate
 *
 * Overlay that locks the app when returning from background.
 * - Shows an opaque screen to hide content in the task switcher (privacy screen)
 * - Requires biometric/passcode auth to unlock on foreground return
 * - Does NOT lock on initial launch (getMnemonic already triggers biometric)
 * - Skips lock entirely when no wallet exists (onboarding flow)
 *
 * IMPORTANT: A system dialog makes the app leave the `active` state, so it looks
 * the same as the user leaving. Both platforms report it differently:
 * - iOS gives `inactive` only. A real background also gives `background`, so the
 *   two are distinguishable, and auth runs only on background → active.
 * - Android has no `inactive` state at all (AppStateModule reports only `active`
 *   and `background`, and `onHostPause` maps to `background`), so a dialog is
 *   indistinguishable from a real background.
 *
 * Because of Android, the app must declare its own dialogs: every call that
 * opens one runs inside `runOsPrompt` (see @/utils/osPrompt), and this gate
 * skips the lock while `isOsPromptActive()` holds.
 *
 * KNOWN COST, Android only: if the user really backgrounds the app while a
 * dialog the app opened is on screen, the lock does not arm. JS cannot tell the
 * two cases apart there — `LifecycleEventListener` has no `onHostStop`, and
 * `onUserLeaveHint` never reaches JS. A native module that exposes one of those
 * is the only strict fix. `osPrompt` bounds the window with a timeout.
 *
 * iOS has no such cost: a dialog never produces `background`, so that branch
 * ignores the guard and always locks.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, Platform, View, StyleSheet } from 'react-native';
import type { AppStateStatus } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KeychainService } from '@/services/keychain';
import { isOsPromptActive } from '@/utils/osPrompt';
import { useColors } from '@/contexts';
import { Text, Button } from '@/components/ui';
import { spacing } from '@/theme';

interface AuthGateProps {
  children: React.ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const colors = useColors();
  const [isLocked, setIsLocked] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const hasWalletRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const wentToBackgroundRef = useRef(false);
  const isAuthenticatingRef = useRef(false);

  const checkWallet = useCallback(async () => {
    hasWalletRef.current = await KeychainService.isWalletCreated();
  }, []);

  useEffect(() => {
    checkWallet();
  }, [checkWallet]);

  const authenticate = useCallback(async () => {
    if (isAuthenticatingRef.current) return;
    isAuthenticatingRef.current = true;
    setIsAuthenticating(true);
    try {
      const success = await KeychainService.authenticateUser('Unlock Starr Wallet');
      if (success) {
        setIsLocked(false);
      }
    } finally {
      isAuthenticatingRef.current = false;
      setIsAuthenticating(false);
    }
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      // App going to background — show overlay & mark for auth on return
      if (nextState === 'background') {
        // On Android every dialog the app opens arrives here, and locking would
        // ask the user to unlock the wallet just for granting a permission. On
        // iOS a dialog never reaches this branch, so `background` always means
        // the user left and must always lock.
        if (Platform.OS === 'android' && isOsPromptActive()) return;
        await checkWallet();
        if (hasWalletRef.current) {
          wentToBackgroundRef.current = true;
          setIsLocked(true);
        }
        return;
      }

      // App going inactive (task switcher, incoming call, system dialog)
      // Show overlay as privacy screen but do NOT mark for auth. A dialog the
      // app opened needs no privacy screen — the overlay would only flash
      // behind it.
      if (nextState === 'inactive') {
        if (hasWalletRef.current && !isOsPromptActive()) {
          setIsLocked(true);
        }
        return;
      }

      // App becoming active
      if (nextState === 'active') {
        // Only require auth if app was fully backgrounded
        if (wentToBackgroundRef.current && hasWalletRef.current) {
          wentToBackgroundRef.current = false;
          authenticate();
        } else if (prev === 'inactive' && !isAuthenticatingRef.current) {
          // Returning from task switcher peek (no background) — just unlock
          setIsLocked(false);
        }
      }
    });

    return () => subscription.remove();
  }, [authenticate, checkWallet]);

  return (
    <>
      {children}
      {isLocked && (
        <View style={[styles.overlay, { backgroundColor: colors.background.primary }]}>
          <View style={styles.content}>
            <View style={[styles.logoCircle, { backgroundColor: colors.gold.glow, borderColor: colors.gold.pure }]}>
              <Ionicons name="logo-bitcoin" size={48} color={colors.gold.pure} />
            </View>
            <Text variant="displaySmall" color={colors.text.primary}>
              Starr
            </Text>
            <Text variant="bodyMedium" color={colors.text.secondary}>
              Wallet is locked
            </Text>
          </View>
          <View style={styles.actions}>
            <Button
              title="Unlock"
              onPress={authenticate}
              variant="primary"
              size="lg"
              loading={isAuthenticating}
              icon={<Ionicons name="lock-open" size={18} color="#FFFFFF" />}
            />
          </View>
        </View>
      )}
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
  },
});
