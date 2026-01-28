/**
 * Node.js adapter: in-memory key storage and crypto.getRandomValues.
 * Suitable for tests or server-side use without secure hardware storage.
 */

import type { IKeyStorage, IRandomValues } from "./types";

/**
 * In-memory key storage. Keys are not persisted across process restarts.
 */
export function createNodeKeyStorage(): IKeyStorage {
  const store = new Map<string, string>();
  return {
    async getItem(key: string): Promise<string | null> {
      return store.get(key) ?? null;
    },
    async setItem(key: string, value: string): Promise<void> {
      store.set(key, value);
    },
    async removeItem(key: string): Promise<void> {
      store.delete(key);
    },
  };
}

/**
 * Random values using Node's crypto.webcrypto or global crypto.
 */
export function createNodeRandomValues(): IRandomValues {
  const crypto =
    typeof globalThis !== "undefined" && (globalThis as any).crypto
      ? (globalThis as any).crypto
      : typeof require !== "undefined"
        ? (require("crypto").webcrypto ?? require("crypto"))
        : null;
  if (!crypto || !crypto.getRandomValues) {
    throw new Error(
      "expo-crypto-lib: No getRandomValues available. In Node, use Node 19+ or polyfill crypto.getRandomValues.",
    );
  }
  return {
    getRandomValues<T extends ArrayBufferView | null>(array: T): T {
      return crypto.getRandomValues(array) as T;
    },
  };
}
