/**
 * Sentry configuration.
 *
 * Configure via environment variables:
 * - EXPO_PUBLIC_SENTRY_DSN=https://...
 */

export const SENTRY_CONFIG = {
  DSN: process.env.EXPO_PUBLIC_SENTRY_DSN || '',
};
