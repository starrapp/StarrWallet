const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'web-build/**',
      'android/**',
      'ios/**',
      // Standalone Cloudflare Workers with their own dependencies.
      'infra/**',
    ],
  },
  ...expoConfig,
  {
    rules: {
      indent: ['error', 2, { SwitchCase: 1 }],
    },
  },
]);
