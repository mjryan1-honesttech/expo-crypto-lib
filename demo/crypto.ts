/**
 * One manager for "you", one for a simulated peer, plus the small helpers the
 * screens share.
 *
 * The peer exists so the public-key half of the library can be demonstrated on
 * a single phone. It is built with a hand-written in-memory IKeyStorage, which
 * doubles as an example of the adapter interface: nothing about CryptoManager
 * is tied to expo-secure-store.
 */

import { base64 } from '@scure/base';
import {
  CryptoError,
  CryptoManager,
  createCryptoManager,
  createExpoRandomValues,
  type IKeyStorage,
} from 'expo-crypto-lib';

/** Your identity, persisted in the real iOS Keychain / Android Keystore. */
export const me = createCryptoManager({
  platform: 'expo',
  storageKeyPrefix: 'demo',
});

function createMemoryKeyStorage(): IKeyStorage {
  const items = new Map<string, string>();
  return {
    async getItem(key) {
      return items.get(key) ?? null;
    },
    async setItem(key, value) {
      items.set(key, value);
    },
    async removeItem(key) {
      items.delete(key);
    },
  };
}

/** A stand-in for someone else's device. Lives only in memory. */
export const peer = new CryptoManager({
  keyStorage: createMemoryKeyStorage(),
  randomValues: createExpoRandomValues(),
});

export const encodeBase64 = (bytes: Uint8Array): string => base64.encode(bytes);
export const decodeBase64 = (text: string): Uint8Array =>
  base64.decode(text.trim());

export const encodeUtf8 = (text: string): Uint8Array =>
  new TextEncoder().encode(text);
export const decodeUtf8 = (bytes: Uint8Array): string =>
  new TextDecoder().decode(bytes);

/**
 * Every failure in this library is a CryptoError with a machine-readable code,
 * so the UI can say AUTH_FAILED rather than guessing from a message string.
 */
export function describeError(error: unknown): string {
  if (error instanceof CryptoError) return `${error.code} — ${error.message}`;
  return error instanceof Error ? error.message : String(error);
}

/** First and last few characters, for keys too long to show in full. */
export function abbreviate(text: string, edge = 12): string {
  return text.length <= edge * 2 + 3
    ? text
    : `${text.slice(0, edge)}…${text.slice(-edge)}`;
}
