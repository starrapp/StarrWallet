/**
 * Breez SDK Configuration
 * 
 * Configure via environment variables in .env file:
 * 
 * EXPO_PUBLIC_BREEZ_API_KEY=your_key_here
 * EXPO_PUBLIC_NETWORK=bitcoin
 * 
 * For Greenlight node registration, you need EITHER:
 * - Partner credentials (developer certificate) - RECOMMENDED
 *   EXPO_PUBLIC_BREEZ_DEV_CERT_BASE64=base64_encoded_cert
 *   EXPO_PUBLIC_BREEZ_DEV_KEY_BASE64=base64_encoded_key
 * 
 * - OR an invite code (for testing)
 *   EXPO_PUBLIC_BREEZ_INVITE_CODE=your_invite_code
 * 
 * EXPO_PUBLIC_BREEZ_ENVIRONMENT=staging (optional, defaults to staging)
 * 
 * Get your API key from: https://breez.technology/sdk/
 * Get developer certificate from: https://blockstream.github.io/greenlight/getting-started/certs/
 */

/**
 * Convert base64 string to byte array (number[])
 */
function base64ToByteArray(base64: string): number[] {
  // Remove PEM headers/footers and whitespace
  const cleanBase64 = base64
    .replace(/-----BEGIN [A-Z ]+-----/g, '')
    .replace(/-----END [A-Z ]+-----/g, '')
    .replace(/\s/g, '');
  
  // Convert base64 to binary string, then to byte array
  const binaryString = atob(cleanBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return Array.from(bytes);
}

export const BREEZ_CONFIG = {
  // Read from environment variable (set in .env file)
  API_KEY: process.env.EXPO_PUBLIC_BREEZ_API_KEY || '',
  
  // Network: 'bitcoin' for mainnet, 'testnet' for testing
  NETWORK: (process.env.EXPO_PUBLIC_NETWORK || 'bitcoin') as 'bitcoin' | 'testnet',
  
  // Greenlight partner credentials (developer certificate)
  // These are base64-encoded PEM files from Greenlight Developer Console
  // Get them from: https://blockstream.github.io/greenlight/getting-started/certs/
  getPartnerCredentials(): { developerKey: number[]; developerCert: number[] } | undefined {
    const certBase64 = process.env.EXPO_PUBLIC_BREEZ_DEV_CERT_BASE64;
    const keyBase64 = process.env.EXPO_PUBLIC_BREEZ_DEV_KEY_BASE64;
    
    if (certBase64 && keyBase64) {
      return {
        developerCert: base64ToByteArray(certBase64),
        developerKey: base64ToByteArray(keyBase64),
      };
    }
    return undefined;
  },
  
  // Greenlight invite code (alternative to partner credentials, for testing)
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
