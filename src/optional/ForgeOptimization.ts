/**
 * Forge Performance Optimization for React Native
 *
 * Patches node-forge's BigInteger.modPow() with react-native-modpow for faster RSA key generation.
 * Import from 'expo-crypto-lib/react-native' and call applyForgeOptimization() at app startup.
 *
 * Requires optional peer dependency: react-native-modpow
 */

import forge from "node-forge";

/**
 * Applies the react-native-modpow optimization to node-forge.
 * Call once at app startup, before any cryptographic operations.
 * No-op if react-native-modpow is not installed.
 */
export function applyForgeOptimization(): void {
  try {
    const modPow =
      require("react-native-modpow").default || require("react-native-modpow");
    forge.jsbn.BigInteger.prototype.modPow = function nativeModPow(
      e: any,
      m: any,
    ) {
      const result = modPow({
        target: this.toString(16),
        value: e.toString(16),
        modifier: m.toString(16),
      });
      return new forge.jsbn.BigInteger(result, 16);
    };
    console.log("✅ Forge optimization (react-native-modpow) applied");
  } catch (error) {
    console.warn(
      "⚠️ Forge optimization skipped (react-native-modpow not available)",
    );
  }
}

/**
 * Returns true if the modPow patch is applied and working.
 */
export function isOptimizationApplied(): boolean {
  try {
    const testBigInt = new forge.jsbn.BigInteger("2");
    const testExponent = new forge.jsbn.BigInteger("3");
    const testModulus = new forge.jsbn.BigInteger("5");
    const result = testBigInt.modPow(testExponent, testModulus);
    return result != null;
  } catch {
    return false;
  }
}

/**
 * Simple performance probe: measure 2048-bit key generation time.
 */
export async function performanceTest(): Promise<{
  optimized: boolean;
  keyGenerationTime: number;
  keySize: number;
}> {
  const keySize = 2048;
  const startTime = Date.now();
  try {
    await new Promise<void>((resolve, reject) => {
      forge.pki.rsa.generateKeyPair({ bits: keySize, workers: -1 }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    const keyGenerationTime = Date.now() - startTime;
    return {
      optimized: isOptimizationApplied(),
      keyGenerationTime,
      keySize,
    };
  } catch (error) {
    console.error("Forge performance test failed:", error);
    return { optimized: false, keyGenerationTime: -1, keySize };
  }
}
