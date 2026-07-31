/**
 * expo-crypto-lib – X25519 + HPKE encryption with BIP39 key recovery.
 */

import { CryptoManager } from "./CryptoManager";
import {
  createExpoKeyStorage,
  createExpoRandomValues,
} from "./adapters/expoAdapter";
import {
  createNodeKeyStorage,
  createNodeRandomValues,
} from "./adapters/nodeAdapter";

export { CryptoManager } from "./CryptoManager";
export type { CryptoManagerOptions } from "./CryptoManager";

export { CryptoError } from "./errors";
export type { CryptoErrorCode } from "./errors";

export { MODE_HPKE, MODE_LOCAL, VERSION, readMode } from "./envelope";

export {
  deriveIdentityKeyPair,
  deriveLocalKey,
  generateMnemonicPhrase,
  mnemonicToSeed,
  validateMnemonicPhrase,
} from "./kdf";
export type { IdentityKeyPair } from "./kdf";

export type { IKeyStorage, IRandomValues } from "./adapters/types";
export {
  createExpoKeyStorage,
  createExpoRandomValues,
} from "./adapters/expoAdapter";
export type { ExpoKeyStorageOptions } from "./adapters/expoAdapter";
export {
  createNodeKeyStorage,
  createNodeRandomValues,
} from "./adapters/nodeAdapter";

/**
 * Options for the convenience factory. Use platform 'node' in Node or tests;
 * use 'expo' in React Native/Expo.
 */
export type CreateCryptoManagerOptions =
  | { platform: "node"; storageKeyPrefix?: string }
  | {
      platform: "expo";
      storageKeyPrefix?: string;
      /** Passed through to expo-secure-store, e.g. { requireAuthentication: true }. */
      storageOptions?: import("./adapters/expoAdapter").ExpoKeyStorageOptions;
    };

/**
 * One-line factory: builds a CryptoManager with the right adapters.
 * - Node / tests: createCryptoManager({ platform: 'node' })
 * - Expo / React Native: createCryptoManager({ platform: 'expo' })
 */
export function createCryptoManager(
  options: CreateCryptoManagerOptions,
): CryptoManager {
  if (options.platform === "node") {
    return new CryptoManager({
      keyStorage: createNodeKeyStorage(),
      randomValues: createNodeRandomValues(),
      storageKeyPrefix: options.storageKeyPrefix,
    });
  }
  return new CryptoManager({
    keyStorage: createExpoKeyStorage(options.storageOptions),
    randomValues: createExpoRandomValues(),
    storageKeyPrefix: options.storageKeyPrefix,
  });
}
