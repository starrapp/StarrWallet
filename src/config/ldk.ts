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
 * 
 * Configuration priority:
 * 1. Runtime config from ConfigService (user-configured in app)
 * 2. Environment variables (from .env file)
 * 3. Defaults
 */

import { ConfigService } from '@/services/config';

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

// Load configuration from environment variables (fallback)
const ENV_LDK_CONFIG: LDKConfig = {
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

// Get runtime config (async, from AsyncStorage)
let cachedLDKConfig: LDKConfig | null = null;

export const getLDKConfig = async (): Promise<LDKConfig> => {
  // Try to get runtime config first
  const runtimeConfig = await ConfigService.getLDKConfig();
  
  if (runtimeConfig) {
    cachedLDKConfig = {
      ...ENV_LDK_CONFIG,
      ...runtimeConfig, // Runtime config overrides env vars
    };
    return cachedLDKConfig;
  }
  
  // Fall back to env vars
  cachedLDKConfig = ENV_LDK_CONFIG;
  return cachedLDKConfig;
};

// Synchronous getter (uses cached value or env vars)
export const LDK_CONFIG: LDKConfig = ENV_LDK_CONFIG;

export const isLDKConfigured = async (): Promise<boolean> => {
  const config = await getLDKConfig();
  
  // Check if REST API mode is configured
  if (config.restUrl && config.restUrl !== 'http://localhost:3000') {
    return true;
  }
  
  // Check if native mode is configured (dataDir is required)
  if (config.dataDir) {
    return true;
  }
  
  return false;
};

export const isLDKRestMode = async (): Promise<boolean> => {
  const config = await getLDKConfig();
  return !!(config.restUrl && config.restUrl !== 'http://localhost:3000');
};

export const isLDKNativeMode = async (): Promise<boolean> => {
  const config = await getLDKConfig();
  return !!config.dataDir;
};
