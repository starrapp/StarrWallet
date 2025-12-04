// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add support for additional file extensions if needed
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

// Note: The @noble/hashes/crypto.js warning is harmless.
// It's used by bip39 and Metro falls back to file-based resolution, which works fine.

module.exports = config;

