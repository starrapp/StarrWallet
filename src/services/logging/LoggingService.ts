/**
 * Sentry setup.
 *
 * Breez requires SDK logs through DEBUG to diagnose reported issues.
 * Sentry captures SDK console output as logs and breadcrumbs.
 * @see https://sdk-doc-spark.breez.technology/guide/moving_to_production.html
 */

import * as Sentry from '@sentry/react-native';

import { SENTRY_CONFIG } from '@/config';

export function initSentry(): void {
  if (!SENTRY_CONFIG.DSN) return;

  Sentry.init({
    dsn: SENTRY_CONFIG.DSN,
    environment: __DEV__ ? 'development' : 'production',
    enableLogs: true,

    // Breez logs at DEBUG are verbose and would push user actions out of the
    // default 100-entry window.
    maxBreadcrumbs: 300,

    // Never enable attachScreenshot, attachViewHierarchy or session replay:
    // the seed phrase is on screen in app/onboarding/{create,backup,import}.
    // sendDefaultPii sends the user IP.
    sendDefaultPii: false,
  });
}

export const wrapRoot = Sentry.wrap;

/**
 * Reports a failure that stops the wallet from working. Errors the user caused,
 * such as an amount below the minimum, stay out of Sentry.
 */
export const captureException = Sentry.captureException;
