/**
 * Key derivation: BIP39 mnemonic -> seed -> identity keypair and local data key.
 *
 * All of it is deterministic, so the same phrase always yields the same keys:
 *
 *   BIP39 24-word phrase
 *     -> mnemonicToSeed (PBKDF2-HMAC-SHA512, 2048 iterations) -> 64-byte seed
 *          -> HKDF-SHA256(info = ".../identity") -> X25519 keypair
 *          -> HKDF-SHA256(info = ".../local")    -> 32-byte symmetric key
 */

import { x25519 } from "@noble/curves/ed25519";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";
import {
  entropyToMnemonic,
  mnemonicToSeedSync,
  validateMnemonic,
} from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";

import type { IRandomValues } from "./adapters/types";
import { CryptoError } from "./errors";

/** 32 bytes of entropy produces a 24-word phrase. */
const ENTROPY_BYTES = 32;

const IDENTITY_INFO = "expo-crypto-lib/v2/identity";
const LOCAL_INFO = "expo-crypto-lib/v2/local";

export interface IdentityKeyPair {
  /** X25519 private scalar, 32 bytes. */
  privateKey: Uint8Array;
  /** X25519 public key, 32 bytes. */
  publicKey: Uint8Array;
}

/**
 * Generate a 24-word BIP39 phrase with a valid checksum.
 * Entropy comes from the supplied adapter, never from a global crypto object,
 * so this works in React Native without a WebCrypto polyfill.
 */
export function generateMnemonicPhrase(random: IRandomValues): string {
  const entropy = random.getRandomValues(new Uint8Array(ENTROPY_BYTES));
  return entropyToMnemonic(entropy, wordlist);
}

/** True only for a phrase whose words and checksum are both valid BIP39. */
export function validateMnemonicPhrase(mnemonic: string): boolean {
  try {
    return validateMnemonic(normalize(mnemonic), wordlist);
  } catch {
    return false;
  }
}

/**
 * Derive the 64-byte seed. Rejects an invalid phrase rather than deriving a
 * different key from it, so a typo surfaces as an error instead of silent data loss.
 */
export function mnemonicToSeed(
  mnemonic: string,
  passphrase: string = "",
): Uint8Array {
  const normalized = normalize(mnemonic);
  if (!validateMnemonicPhrase(normalized)) {
    throw new CryptoError(
      "INVALID_MNEMONIC",
      "Not a valid BIP39 phrase: check the word count, spelling, and word order",
    );
  }
  return mnemonicToSeedSync(normalized, passphrase);
}

/** Derive the X25519 identity keypair used for encrypting to a public key. */
export function deriveIdentityKeyPair(seed: Uint8Array): IdentityKeyPair {
  const privateKey = hkdf(sha256, seed, undefined, IDENTITY_INFO, 32);
  return { privateKey, publicKey: x25519.getPublicKey(privateKey) };
}

/** Derive the symmetric key used for at-rest encryption on this device. */
export function deriveLocalKey(seed: Uint8Array): Uint8Array {
  return hkdf(sha256, seed, undefined, LOCAL_INFO, 32);
}

/** BIP39 phrases are space-separated; collapse incidental whitespace. */
function normalize(mnemonic: string): string {
  return mnemonic.trim().split(/\s+/).join(" ");
}
