/**
 * Expo/React Native adapter for key storage and random values.
 * Requires peer dependencies: expo-secure-store, expo-crypto.
 */

import { CryptoError } from "../errors";
import type { IKeyStorage, IRandomValues } from "./types";

const EXPO_SECURE_STORE_HINT =
  "expo-crypto-lib: expo-secure-store is required for createExpoKeyStorage(). Install with: npx expo install expo-secure-store";

const EXPO_CRYPTO_HINT =
  "expo-crypto-lib: expo-crypto is required for createExpoRandomValues(). Install with: npx expo install expo-crypto";

/**
 * iOS has historically rejected SecureStore values above roughly 2048 bytes.
 * Everything this library stores is far smaller, so exceeding it means a caller
 * passed something unexpected — better to say so than to fail inside the platform.
 */
const MAX_VALUE_BYTES = 2048;

/**
 * Security options forwarded to expo-secure-store. Defaults are whatever
 * expo-secure-store defaults to; nothing is set implicitly here.
 *
 * @see https://docs.expo.dev/versions/latest/sdk/securestore/
 */
export interface ExpoKeyStorageOptions {
  /** Require biometric/device authentication for access. */
  requireAuthentication?: boolean;
  /** Message shown in the authentication prompt. */
  authenticationPrompt?: string;
  /**
   * iOS accessibility class, e.g. SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY.
   * Pass the constant from expo-secure-store.
   */
  keychainAccessible?: unknown;
  /** Service name (iOS) / key alias (Android) the entry is stored under. */
  keychainService?: string;
  /** iOS keychain access group, for sharing entries between your own apps. */
  accessGroup?: string;
}

type SecureStoreModule = {
  getItemAsync: (key: string, options?: object) => Promise<string | null>;
  setItemAsync: (key: string, value: string, options?: object) => Promise<void>;
  deleteItemAsync: (key: string, options?: object) => Promise<void>;
};

function getExpoSecureStore(): SecureStoreModule {
  try {
    const SecureStore = require("expo-secure-store");
    return {
      getItemAsync: SecureStore.getItemAsync ?? SecureStore.getItem,
      setItemAsync: SecureStore.setItemAsync ?? SecureStore.setItem,
      deleteItemAsync: SecureStore.deleteItemAsync ?? SecureStore.removeItem,
    };
  } catch (err) {
    throw new Error(
      `${EXPO_SECURE_STORE_HINT}\nOriginal error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

function getExpoCrypto(): {
  getRandomValues: (array: ArrayBufferView) => ArrayBufferView;
} {
  try {
    const Crypto = require("expo-crypto");
    return {
      getRandomValues:
        Crypto.getRandomValues ?? ((array: ArrayBufferView) => array),
    };
  } catch (err) {
    throw new Error(
      `${EXPO_CRYPTO_HINT}\nOriginal error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Key storage using expo-secure-store.
 *
 * Pass options to gate access behind biometrics or restrict accessibility:
 *   createExpoKeyStorage({ requireAuthentication: true,
 *                          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY })
 */
export function createExpoKeyStorage(
  options: ExpoKeyStorageOptions = {},
): IKeyStorage {
  const store = getExpoSecureStore();
  const storeOptions = { ...options } as object;
  return {
    async getItem(key: string): Promise<string | null> {
      return store.getItemAsync(key, storeOptions);
    },
    async setItem(key: string, value: string): Promise<void> {
      const byteLength = utf8ByteLength(value);
      if (byteLength > MAX_VALUE_BYTES) {
        throw new CryptoError(
          "VALUE_TOO_LARGE",
          `Value is ${byteLength} bytes; expo-secure-store rejects values above about ${MAX_VALUE_BYTES} bytes on iOS`,
        );
      }
      await store.setItemAsync(key, value, storeOptions);
    },
    async removeItem(key: string): Promise<void> {
      await store.deleteItemAsync(key, storeOptions);
    },
  };
}

/**
 * Random values using expo-crypto.
 */
export function createExpoRandomValues(): IRandomValues {
  const crypto = getExpoCrypto();
  return {
    getRandomValues<T extends ArrayBufferView | null>(array: T): T {
      if (array == null) return array;
      return crypto.getRandomValues(array) as T;
    },
  };
}

/** Byte length of a string once UTF-8 encoded, which is what the platform stores. */
function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}
