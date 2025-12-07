/**
 * LDK Configuration
 * 
 * Configuration for Lightning Development Kit (LDK) and LDK Node.
 * 
 * LDK Node can be used in two ways:
 * 1. As a REST API server (easier for development/testing)
 * 2. Embedded as a native module (better for production mobile apps)
 * 
 * For now, we'll use the REST API approach. To embed LDK Node natively,
 * you'll need to create native modules for iOS (Swift) and Android (Kotlin).
 */

export interface LDKConfig {
  // REST API mode (when LDK Node is running as a separate service)
  restUrl?: string;
  apiKey?: string;
  
  // Native mode (when LDK is embedded in the app)
  // These will be used when native modules are implemented
  dataDir?: string;
  network?: 'bitcoin' | 'testnet' | 'signet' | 'regtest';
  esploraServerUrl?: string;
  lspUrl?: string;
  lspToken?: string;
}

// Load configuration from environment variables
export const LDK_CONFIG: LDKConfig = {
  // REST API configuration (for LDK Node running as a service)
  restUrl: process.env.EXPO_PUBLIC_LDK_REST_URL || 'http://localhost:3000',
  apiKey: process.env.EXPO_PUBLIC_LDK_API_KEY || '',
  
  // Native mode configuration (for embedded LDK)
  dataDir: process.env.EXPO_PUBLIC_LDK_DATA_DIR || '',
  network: (process.env.EXPO_PUBLIC_LDK_NETWORK || 'testnet') as 'bitcoin' | 'testnet' | 'signet' | 'regtest',
  esploraServerUrl: process.env.EXPO_PUBLIC_LDK_ESPLORA_URL || '',
  lspUrl: process.env.EXPO_PUBLIC_LDK_LSP_URL || '',
  lspToken: process.env.EXPO_PUBLIC_LDK_LSP_TOKEN || '',
};

export const isLDKConfigured = (): boolean => {
  // Check if REST API mode is configured
  if (LDK_CONFIG.restUrl && LDK_CONFIG.restUrl !== 'http://localhost:3000') {
    return true;
  }
  
  // Check if native mode is configured (dataDir is required)
  if (LDK_CONFIG.dataDir) {
    return true;
  }
  
  return false;
};

export const isLDKRestMode = (): boolean => {
  return !!(LDK_CONFIG.restUrl && LDK_CONFIG.restUrl !== 'http://localhost:3000');
};

export const isLDKNativeMode = (): boolean => {
  return !!LDK_CONFIG.dataDir;
};
