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
 * Random values using the global Web Crypto object.
 *
 * Deliberately does not fall back to Node's built-in crypto module. Metro
 * resolves require calls statically when bundling, so a Node built-in
 * referenced anywhere reachable from the package entry point breaks React
 * Native bundling outright — even on a branch that could never execute there.
 * `globalThis.crypto` has been available since Node 19, below this package's
 * Node 20.19.4 floor, so the fallback bought nothing.
 */
export function createNodeRandomValues(): IRandomValues {
  const crypto = (globalThis as any).crypto;
  if (!crypto || typeof crypto.getRandomValues !== "function") {
    throw new Error(
      "expo-crypto-lib: No global crypto.getRandomValues available. Use Node 20.19.4+ or polyfill globalThis.crypto.",
    );
  }
  // Web Crypto requires its own receiver.
  const fill = crypto.getRandomValues.bind(crypto);
  return {
    getRandomValues<T extends ArrayBufferView | null>(array: T): T {
      if (array == null) return array;
      return fill(array) as T;
    },
  };
}
