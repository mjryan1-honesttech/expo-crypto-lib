// API-only module: run tests in Node only (no iOS/Android React Native setup).
const createJestPreset = require('expo-module-scripts/createJestPreset');
const nodePreset = require('jest-expo/node/jest-preset');

module.exports = {
  ...createJestPreset(nodePreset),
  prettierPath: require.resolve('jest-snapshot-prettier'),
};
