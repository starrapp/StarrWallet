/**
 * Send Store
 *
 * Ephemeral in-memory store for new payment requests. Each request opens one
 * new Send screen.
 */

import { router } from 'expo-router';
import type { SendRequest } from '@/types/wallet';

// A cold-start link waits here for app/index.tsx, and any request waits while
// a payment sends.
let pendingSend: SendRequest | null = null;
let paymentInFlight = false;

export function setPendingSend(request: SendRequest) {
  pendingSend = request;
}

export function takePendingSend(): SendRequest | null {
  const request = pendingSend;
  pendingSend = null;
  return request;
}

/** Closes all open screens, so that only one Send screen exists. */
export function openSend(request: SendRequest) {
  // A payment that is sending must finish first. Its alert closes the screen.
  if (paymentInFlight) {
    pendingSend = request;
    return;
  }
  if (router.canDismiss()) router.dismissAll();
  // The scanner can be a tab. Cancel on Send must not go back to it.
  router.navigate('/(tabs)');
  router.push({ pathname: '/send', params: { ...request } });
}

export function hasPendingSend(): boolean {
  return pendingSend != null;
}

/** From the Send tap until the user closes the result. */
export function beginPayment() {
  paymentInFlight = true;
}

/** True when a waiting request was opened. That also closes the current screen. */
export function endPayment(): boolean {
  paymentInFlight = false;
  const request = takePendingSend();
  if (request) openSend(request);
  return request != null;
}
