/**
 * LND Configuration
 * 
 * Configure connection to your own LND node via environment variables:
 * 
 * EXPO_PUBLIC_LND_ENABLED=true
 * EXPO_PUBLIC_LND_REST_URL=https://your-lnd-node.local:8080
 * EXPO_PUBLIC_LND_MACAROON=base64_encoded_macaroon
 * EXPO_PUBLIC_LND_CERT=base64_encoded_cert (optional, for self-signed certs)
 * 
 * OR use LND Connect URL format:
 * EXPO_PUBLIC_LND_CONNECT_URL=lndconnect://host:port?macaroon=...&cert=...
 * 
 * For Tor/onion addresses:
 * EXPO_PUBLIC_LND_REST_URL=https://your-onion-address.onion:8080
 * 
 * Note: For .onion addresses, you'll need Tor proxy support.
 * On iOS/Android, this typically requires a VPN or Tor app integration.
 * 
 * Configuration priority:
 * 1. Runtime config from ConfigService (user-configured in app)
 * 2. Environment variables (from .env file)
 * 3. Defaults
 */

import { ConfigService } from '@/services/config';

export interface LNDConfig {
  enabled: boolean;
  restUrl: string;
  macaroon: string;
  cert?: string;
  connectUrl?: string;
  // Tor proxy settings (if needed)
  torProxy?: {
    host: string;
    port: number;
  };
}

// Load configuration from environment variables (fallback)
const ENV_LND_CONFIG: LNDConfig = {
  enabled: process.env.EXPO_PUBLIC_LND_ENABLED === 'true',
  restUrl: process.env.EXPO_PUBLIC_LND_REST_URL || '',
  macaroon: process.env.EXPO_PUBLIC_LND_MACAROON || '',
  cert: process.env.EXPO_PUBLIC_LND_CERT || undefined,
  connectUrl: process.env.EXPO_PUBLIC_LND_CONNECT_URL || undefined,
  // Tor proxy (if using system Tor or VPN)
  torProxy: process.env.EXPO_PUBLIC_TOR_PROXY_HOST
    ? {
        host: process.env.EXPO_PUBLIC_TOR_PROXY_HOST,
        port: parseInt(process.env.EXPO_PUBLIC_TOR_PROXY_PORT || '9050', 10),
      }
    : undefined,
};

// Get runtime config (async, from AsyncStorage)
let cachedLNDConfig: LNDConfig | null = null;

export const getLNDConfig = async (): Promise<LNDConfig> => {
  // Try to get runtime config first
  const runtimeConfig = await ConfigService.getLNDConfig();
  
  if (runtimeConfig) {
    cachedLNDConfig = {
      ...ENV_LND_CONFIG,
      ...runtimeConfig, // Runtime config overrides env vars
      // Preserve Tor proxy from env if not in runtime config
      torProxy: runtimeConfig.torProxy || ENV_LND_CONFIG.torProxy,
    };
    return cachedLNDConfig;
  }
  
  // Fall back to env vars
  cachedLNDConfig = ENV_LND_CONFIG;
  return cachedLNDConfig;
};

// Synchronous getter (uses cached value or env vars)
export const LND_CONFIG: LNDConfig = ENV_LND_CONFIG;

// LND Connect URL (from env or runtime config)
export const getLNDConnectURL = async (): Promise<string> => {
  const config = await getLNDConfig();
  return config.connectUrl || '';
};

/**
 * Check if LND is configured
 */
export const isLNDConfigured = async (): Promise<boolean> => {
  const config = await getLNDConfig();
  
  if (!config.enabled) return false;
  
  // Check if we have LND Connect URL or individual credentials
  if (config.connectUrl && config.connectUrl.trim() !== '') return true;
  if (config.restUrl && config.macaroon && config.restUrl.trim() !== '' && config.macaroon.trim() !== '') return true;
  
  return false;
};

/**
 * Check if URL is a Tor .onion address
 */
export const isOnionAddress = (url: string): boolean => {
  return url.includes('.onion');
};

