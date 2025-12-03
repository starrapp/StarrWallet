/**
 * Breez SDK Configuration
 * 
 * Configure via environment variables in .env file:
 * 
 * EXPO_PUBLIC_BREEZ_API_KEY=your_key_here
 * EXPO_PUBLIC_NETWORK=bitcoin
 * 
 * Get your key from: https://breez.technology/sdk/
 */

export const BREEZ_CONFIG = {
  // Read from environment variable (set in .env file)
  API_KEY: process.env.EXPO_PUBLIC_BREEZ_API_KEY || '',
  
  // Network: 'bitcoin' for mainnet, 'testnet' for testing
  NETWORK: (process.env.EXPO_PUBLIC_NETWORK || 'bitcoin') as 'bitcoin' | 'testnet',
  
  // Working directory for Breez SDK data (leave empty for default)
  WORKING_DIR: '',
};

// Validate config
export const isBreezConfigured = () => {
  return BREEZ_CONFIG.API_KEY.length > 0;
};
