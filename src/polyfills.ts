/**
 * Polyfills for React Native
 * Import this at the top of _layout.tsx
 */

import { Buffer } from 'buffer';

// Make Buffer available globally
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

// TextEncoder/TextDecoder polyfill if needed
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('text-encoding');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

