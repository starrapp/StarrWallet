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
 */

export interface LNDConfig {
  enabled: boolean;
  restUrl: string;
  macaroon: string;
  cert?: string;
  // Tor proxy settings (if needed)
  torProxy?: {
    host: string;
    port: number;
  };
}

export const LND_CONFIG: LNDConfig = {
  enabled: process.env.EXPO_PUBLIC_LND_ENABLED === 'true',
  restUrl: process.env.EXPO_PUBLIC_LND_REST_URL || '',
  macaroon: process.env.EXPO_PUBLIC_LND_MACAROON || '',
  cert: process.env.EXPO_PUBLIC_LND_CERT || undefined,
  // Tor proxy (if using system Tor or VPN)
  torProxy: process.env.EXPO_PUBLIC_TOR_PROXY_HOST
    ? {
        host: process.env.EXPO_PUBLIC_TOR_PROXY_HOST,
        port: parseInt(process.env.EXPO_PUBLIC_TOR_PROXY_PORT || '9050', 10),
      }
    : undefined,
};

// LND Connect URL (alternative format)
export const LND_CONNECT_URL = process.env.EXPO_PUBLIC_LND_CONNECT_URL || '';

/**
 * Check if LND is configured
 */
export const isLNDConfigured = (): boolean => {
  if (!LND_CONFIG.enabled) return false;
  
  // Check if we have LND Connect URL or individual credentials
  if (LND_CONNECT_URL) return true;
  if (LND_CONFIG.restUrl && LND_CONFIG.macaroon) return true;
  
  return false;
};

/**
 * Check if URL is a Tor .onion address
 */
export const isOnionAddress = (url: string): boolean => {
  return url.includes('.onion');
};

