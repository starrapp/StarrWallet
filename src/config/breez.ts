/**
 * Breez SDK Configuration
 * 
 * Configure via environment variables in .env file:
 * 
 * EXPO_PUBLIC_BREEZ_API_KEY=your_key_here
 * EXPO_PUBLIC_NETWORK=bitcoin
 * EXPO_PUBLIC_BREEZ_INVITE_CODE=your_invite_code (optional, for Greenlight)
 * EXPO_PUBLIC_BREEZ_ENVIRONMENT=staging (optional, defaults to production)
 * 
 * Get your key from: https://breez.technology/sdk/
 * Get invite code from: https://bit.ly/glinvites
 */

export const BREEZ_CONFIG = {
  // Read from environment variable (set in .env file)
  API_KEY: process.env.EXPO_PUBLIC_BREEZ_API_KEY || '',
  
  // Network: 'bitcoin' for mainnet, 'testnet' for testing
  NETWORK: (process.env.EXPO_PUBLIC_NETWORK || 'bitcoin') as 'bitcoin' | 'testnet',
  
  // Greenlight invite code (required for new node registration)
  // Get one from: https://bit.ly/glinvites
  INVITE_CODE: process.env.EXPO_PUBLIC_BREEZ_INVITE_CODE || '',
  
  // Environment: 'production' or 'staging' (staging is better for development)
  ENVIRONMENT: (process.env.EXPO_PUBLIC_BREEZ_ENVIRONMENT || 'staging') as 'production' | 'staging',
  
  // Working directory for Breez SDK data (leave empty for default)
  WORKING_DIR: '',
};

// Validate config
export const isBreezConfigured = () => {
  return BREEZ_CONFIG.API_KEY.length > 0;
};
