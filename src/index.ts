/**
 * expo-crypto-lib – Hybrid RSA + AES encryption with mnemonic-based key derivation.
 */

import { EnhancedRSAManager } from "./EnhancedRSAManager";
import type { EnhancedRSAManagerOptions } from "./EnhancedRSAManager";
import { createExpoKeyStorage, createExpoRandomValues } from "./adapters/expoAdapter";
import { createNodeKeyStorage, createNodeRandomValues } from "./adapters/nodeAdapter";

export { EnhancedRSAManager } from "./EnhancedRSAManager";
export type { EnhancedRSAManagerOptions } from "./EnhancedRSAManager";
export { MnemonicManager } from "./MnemonicManager";

export type {
  CryptoKeyPair,
  ProgressCallback,
  TransmissionPayload,
  ValidationResult,
} from "./types";

export type { IKeyStorage, IRandomValues } from "./adapters/types";
export {
  createExpoKeyStorage,
  createExpoRandomValues,
} from "./adapters/expoAdapter";
export {
  createNodeKeyStorage,
  createNodeRandomValues,
} from "./adapters/nodeAdapter";

/** Options for the convenience factory. Use platform 'node' in Node or tests; use 'expo' in React Native/Expo (pass platformOS from Platform.OS). */
export type CreateRSAManagerOptions =
  | { platform: "node" }
  | { platform: "expo"; platformOS?: string };

/**
 * One-line factory: creates an EnhancedRSAManager with the right adapters for the given platform.
 * - Node / tests: createRSAManager({ platform: 'node' })
 * - Expo / React Native: createRSAManager({ platform: 'expo', platformOS: Platform.OS }) or createRSAManager({ platform: 'expo' }) to auto-detect from react-native
 */
export function createRSAManager(
  options: CreateRSAManagerOptions,
): InstanceType<typeof EnhancedRSAManager> {
  if (options.platform === "node") {
    return new EnhancedRSAManager({
      keyStorage: createNodeKeyStorage(),
      randomValues: createNodeRandomValues(),
      platform: "node",
    });
  }
  let platformOS = options.platformOS;
  if (platformOS == null) {
    try {
      const RN = require("react-native");
      platformOS = RN.Platform?.OS ?? "react-native";
    } catch {
      platformOS = "react-native";
    }
  }
  return new EnhancedRSAManager({
    keyStorage: createExpoKeyStorage(),
    randomValues: createExpoRandomValues(),
    platform: platformOS,
  });
}
