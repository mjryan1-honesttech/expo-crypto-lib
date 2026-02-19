// API-only module: run tests in Node only (no iOS/Android React Native setup).
const createJestPreset = require('expo-module-scripts/createJestPreset');
const nodePreset = require('jest-expo/node/jest-preset');

module.exports = {
  ...createJestPreset(nodePreset),
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  prettierPath: require.resolve('jest-snapshot-prettier'),
};
