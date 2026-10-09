/**
 * Breez Spark SDK configuration.
 *
 * Configure via environment variables:
 * - EXPO_PUBLIC_BREEZ_API_KEY=...
 * - EXPO_PUBLIC_BREEZ_NETWORK=mainnet|regtest
 * - EXPO_PUBLIC_BREEZ_WORKING_DIR=/optional/absolute/path
 * - EXPO_PUBLIC_BREEZ_SYNC_INTERVAL_SECS=60
 * - EXPO_PUBLIC_BREEZ_LNURL_DOMAIN=breez.tips (empty disables Lightning Address)
 */

export const BREEZ_CONFIG = {
  API_KEY: process.env.EXPO_PUBLIC_BREEZ_API_KEY || '',
  NETWORK: (process.env.EXPO_PUBLIC_BREEZ_NETWORK === 'regtest' ? 'regtest' : 'mainnet') as 'mainnet' | 'regtest',
  WORKING_DIR: process.env.EXPO_PUBLIC_BREEZ_WORKING_DIR || '',
  SYNC_INTERVAL_SECS: process.env.EXPO_PUBLIC_BREEZ_SYNC_INTERVAL_SECS
    ? parseInt(process.env.EXPO_PUBLIC_BREEZ_SYNC_INTERVAL_SECS, 10)
    : undefined,
  LNURL_DOMAIN: process.env.EXPO_PUBLIC_BREEZ_LNURL_DOMAIN || '',
};

// The LNURL server has no list of blocked names, so the app refuses these.
export const RESERVED_LIGHTNING_USERNAMES = new Set([
  'admin',
  'administrator',
  'root',
  'system',
  'sysadmin',
  'owner',
  'operator',
  'support',
  'help',
  'helpdesk',
  'info',
  'contact',
  'team',
  'staff',
  'security',
  'moderator',
  'mod',
  'billing',
  'payments',
  'refund',
  'refunds',
  'wallet',
  'official',
  'postmaster',
  'hostmaster',
  'webmaster',
  'abuse',
  'noreply',
  'starr',
  'starrapp',
  'starrwallet',
  'starr.wallet',
  'starr-wallet',
  'starr_wallet',
  'starrteam',
  'starrsupport',
  'starrhelp',
  'starrofficial',
  'breez',
  'spark',
]);
