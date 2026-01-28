/**
 * Expo/React Native adapter for key storage and random values.
 * Requires peer dependencies: expo-secure-store, expo-crypto.
 */

import type { IKeyStorage, IRandomValues } from "./types";

const EXPO_SECURE_STORE_HINT =
  "expo-crypto-lib: expo-secure-store is required for createExpoKeyStorage(). Install with: npx expo install expo-secure-store";

const EXPO_CRYPTO_HINT =
  "expo-crypto-lib: expo-crypto is required for createExpoRandomValues(). Install with: npx expo install expo-crypto";

function getExpoSecureStore(): {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
} {
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
 */
export function createExpoKeyStorage(): IKeyStorage {
  const store = getExpoSecureStore();
  return {
    async getItem(key: string): Promise<string | null> {
      return store.getItemAsync(key);
    },
    async setItem(key: string, value: string): Promise<void> {
      await store.setItemAsync(key, value);
    },
    async removeItem(key: string): Promise<void> {
      await store.deleteItemAsync(key);
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
