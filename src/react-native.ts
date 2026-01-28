/**
 * React Native entry: optional Forge optimization only.
 * Import from 'expo-crypto-lib/react-native' to avoid pulling in react-native-modpow for non-RN consumers.
 */

export {
  applyForgeOptimization,
  isOptimizationApplied,
  performanceTest,
} from "./optional/ForgeOptimization";
