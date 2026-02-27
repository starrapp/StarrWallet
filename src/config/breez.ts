/**
 * Breez Spark SDK configuration.
 *
 * Configure via environment variables:
 * - EXPO_PUBLIC_BREEZ_API_KEY=...
 * - EXPO_PUBLIC_BREEZ_NETWORK=mainnet|regtest
 * - EXPO_PUBLIC_BREEZ_WORKING_DIR=/optional/absolute/path
 * - EXPO_PUBLIC_BREEZ_SYNC_INTERVAL_SECS=60
 */

export const BREEZ_CONFIG = {
  API_KEY: process.env.EXPO_PUBLIC_BREEZ_API_KEY || '',
  NETWORK: (process.env.EXPO_PUBLIC_BREEZ_NETWORK === 'regtest' ? 'regtest' : 'mainnet') as 'mainnet' | 'regtest',
  WORKING_DIR: process.env.EXPO_PUBLIC_BREEZ_WORKING_DIR || '',
  SYNC_INTERVAL_SECS: process.env.EXPO_PUBLIC_BREEZ_SYNC_INTERVAL_SECS
    ? parseInt(process.env.EXPO_PUBLIC_BREEZ_SYNC_INTERVAL_SECS, 10)
    : undefined,
};
