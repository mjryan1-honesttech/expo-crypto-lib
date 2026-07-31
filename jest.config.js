// API-only module: run tests in Node only (no iOS/Android React Native setup).
// expo-module-scripts 55 no longer exports `createJestPreset`, so the TypeScript
// transform it used to wire up is configured here directly.
const nodePreset = require('jest-expo/node/jest-preset');

module.exports = {
  ...nodePreset,
  // Jest uses the first matching pattern, so the TypeScript rule must precede
  // the preset's broader `\.[jt]sx?$` babel rule.
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { types: ['jest', 'node'] } }],
    ...nodePreset.transform,
  },
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  prettierPath: require.resolve('jest-snapshot-prettier'),
};
