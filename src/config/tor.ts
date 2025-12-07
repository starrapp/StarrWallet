/**
 * Tor Configuration
 * 
 * Configure Tor support via environment variables:
 * 
 * EXPO_PUBLIC_TOR_ENABLED=true
 * EXPO_PUBLIC_TOR_AUTO_START=true
 * EXPO_PUBLIC_TOR_SOCKS_PORT=9050
 * 
 * Tor data directory is automatically set to app's document directory.
 */

export interface TorConfig {
  enabled: boolean;
  autoStart: boolean;
  socksPort: number;
  dataDir?: string;
}

export const TOR_CONFIG: TorConfig = {
  enabled: process.env.EXPO_PUBLIC_TOR_ENABLED === 'true',
  autoStart: process.env.EXPO_PUBLIC_TOR_AUTO_START === 'true', // Default to false
  socksPort: parseInt(process.env.EXPO_PUBLIC_TOR_SOCKS_PORT || '9050', 10),
  dataDir: process.env.EXPO_PUBLIC_TOR_DATA_DIR,
};

/**
 * Check if Tor is configured
 */
export const isTorConfigured = (): boolean => {
  return TOR_CONFIG.enabled;
};

