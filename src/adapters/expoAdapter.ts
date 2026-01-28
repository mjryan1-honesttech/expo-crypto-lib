/**
 * Expo/React Native adapter for key storage and random values.
 * Requires peer dependencies: expo-secure-store, expo-crypto.
 */

import type { IKeyStorage, IRandomValues } from "./types";

function getExpoSecureStore(): {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
} {
  // Dynamic require so non-Expo consumers don't fail at load time
  const SecureStore = require("expo-secure-store");
  return {
    getItemAsync: SecureStore.getItemAsync ?? SecureStore.getItem,
    setItemAsync: SecureStore.setItemAsync ?? SecureStore.setItem,
    deleteItemAsync: SecureStore.deleteItemAsync ?? SecureStore.removeItem,
  };
}

function getExpoCrypto(): {
  getRandomValues: (array: ArrayBufferView) => ArrayBufferView;
} {
  const Crypto = require("expo-crypto");
  return {
    getRandomValues:
      Crypto.getRandomValues ?? ((array: ArrayBufferView) => array),
  };
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
