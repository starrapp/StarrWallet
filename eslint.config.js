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
    ],
  },
  ...expoConfig,
  {
    rules: {
      indent: ['error', 2, { SwitchCase: 1 }],
    },
  },
]);
