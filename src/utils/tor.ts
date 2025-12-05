/**
 * Tor/Onion Address Utilities
 * 
 * Utilities for handling Tor .onion addresses in React Native.
 * 
 * Note: React Native doesn't have native Tor support.
 * For .onion connections, you typically need:
 * 1. A Tor proxy (SOCKS5) running locally or via VPN
 * 2. A library that supports SOCKS5 proxying
 * 3. Or use a VPN service that routes through Tor
 * 
 * For production, consider:
 * - react-native-tor: https://github.com/Sifir-io/react-native-tor (if available)
 * - Orion Browser's Tor integration
 * - VPN apps that provide Tor routing
 */

/**
 * Check if a URL is a Tor .onion address
 */
export function isOnionAddress(url: string): boolean {
  return /\.onion(?::\d+)?/.test(url);
}

/**
 * Extract the .onion host from a URL
 */
export function extractOnionHost(url: string): string | null {
  const match = url.match(/([a-z0-9]{56}\.onion)(?::(\d+))?/i);
  return match ? match[1] : null;
}

/**
 * Check if Tor proxy is configured
 * 
 * In a real implementation, this would check if:
 * - A Tor proxy is running
 * - VPN with Tor routing is active
 * - Native Tor module is available
 */
export function isTorProxyAvailable(): boolean {
  // This is a placeholder - in production, check actual Tor availability
  // For now, we assume .onion addresses might work if the system has Tor routing
  return false; // Default to false, user must configure
}

/**
 * Get Tor proxy configuration
 * 
 * Returns SOCKS5 proxy settings if available
 */
export function getTorProxyConfig(): { host: string; port: number } | null {
  // In production, this would read from:
  // - Environment variables
  // - Native Tor module
  // - VPN configuration
  // - User settings
  
  const host = process.env.EXPO_PUBLIC_TOR_PROXY_HOST;
  const port = process.env.EXPO_PUBLIC_TOR_PROXY_PORT;
  
  if (host && port) {
    return {
      host,
      port: parseInt(port, 10),
    };
  }
  
  return null;
}

/**
 * Convert a regular URL to use Tor proxy if needed
 * 
 * This is a placeholder - actual implementation would:
 * 1. Detect .onion addresses
 * 2. Route through Tor proxy
 * 3. Handle SOCKS5 connection
 */
export function prepareTorRequest(url: string): {
  url: string;
  requiresTor: boolean;
  proxy?: { host: string; port: number };
} {
  const isOnion = isOnionAddress(url);
  const proxy = getTorProxyConfig();
  
  return {
    url,
    requiresTor: isOnion,
    proxy: isOnion && proxy ? proxy : undefined,
  };
}

