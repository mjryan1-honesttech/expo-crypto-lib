/**
 * CryptoManager: deterministic X25519 identity from a BIP39 phrase, plus
 * authenticated encryption for local storage and for a recipient's public key.
 *
 * The recovery phrase is returned once by generate() and is never written to
 * storage, so a compromised device does not also surrender the phrase.
 *
 * Two items are stored: the seed (secret, and the one worth gating behind
 * biometrics) and the public key (not secret, readable without a prompt).
 */

import { base64 } from "@scure/base";

import type { IKeyStorage, IRandomValues } from "./adapters/types";
import { openFrom, openLocal, sealLocal, sealTo } from "./envelope";
import { CryptoError } from "./errors";
import {
  deriveIdentityKeyPair,
  deriveLocalKey,
  generateMnemonicPhrase,
  mnemonicToSeed,
} from "./kdf";

const DEFAULT_STORAGE_KEY_PREFIX = "expo-crypto-lib";

const SEED_LENGTH = 64;

export interface CryptoManagerOptions {
  keyStorage: IKeyStorage;
  randomValues: IRandomValues;
  /**
   * Prefix for storage keys. Use different prefixes when multiple apps, tenants,
   * or users share one storage backend. Default: "expo-crypto-lib".
   */
  storageKeyPrefix?: string;
}

export class CryptoManager {
  private readonly storage: IKeyStorage;
  private readonly random: IRandomValues;
  private readonly seedTag: string;
  private readonly publicKeyTag: string;

  private privateKey: Uint8Array | null = null;
  private localKey: Uint8Array | null = null;
  private publicKeyBytes: Uint8Array | null = null;

  constructor(options: CryptoManagerOptions) {
    this.storage = options.keyStorage;
    this.random = options.randomValues;
    const prefix = options.storageKeyPrefix ?? DEFAULT_STORAGE_KEY_PREFIX;
    this.seedTag = `${prefix}.seed`;
    this.publicKeyTag = `${prefix}.publicKey`;
  }

  /** True once keys are loaded in memory. */
  get isReady(): boolean {
    return this.privateKey !== null;
  }

  /** X25519 public key, 32 bytes. Throws NO_KEYS if nothing is loaded. */
  get publicKey(): Uint8Array {
    if (this.publicKeyBytes === null) throw noKeys();
    return new Uint8Array(this.publicKeyBytes);
  }

  /** X25519 public key as base64, for sending to a peer or backend. */
  get publicKeyBase64(): string {
    return base64.encode(this.publicKey);
  }

  /**
   * Create a new identity and persist it.
   *
   * Returns the 24-word recovery phrase. Show it to the user once and let them
   * store it; this library deliberately never writes it anywhere.
   */
  async generate(passphrase: string = ""): Promise<string> {
    const mnemonic = generateMnemonicPhrase(this.random);
    await this.deriveAndStore(mnemonic, passphrase);
    return mnemonic;
  }

  /**
   * Restore an identity from a recovery phrase, replacing anything stored.
   * Throws INVALID_MNEMONIC for a phrase that fails BIP39 checksum validation.
   */
  async recover(mnemonic: string, passphrase: string = ""): Promise<void> {
    await this.deriveAndStore(mnemonic, passphrase);
  }

  /** Load a stored identity. Returns false when there is nothing stored. */
  async load(): Promise<boolean> {
    const stored = await this.readItem(this.seedTag);
    if (stored === null) return false;
    this.useSeed(decodeSeed(stored));
    return true;
  }

  /** Whether an identity is present in storage. */
  async hasKeys(): Promise<boolean> {
    return (await this.readItem(this.seedTag)) !== null;
  }

  /**
   * Read the stored public key without touching the seed. Useful when the seed
   * is gated behind biometrics and you only need to publish the public key.
   */
  async loadPublicKey(): Promise<Uint8Array | null> {
    const stored = await this.readItem(this.publicKeyTag);
    return stored === null ? null : base64.decode(stored);
  }

  /** Remove the stored identity and forget the in-memory keys. */
  async clear(): Promise<void> {
    try {
      await Promise.all([
        this.storage.removeItem(this.seedTag),
        this.storage.removeItem(this.publicKeyTag),
      ]);
    } catch (error) {
      throw new CryptoError("STORAGE_FAILED", storageMessage("clear", error));
    }
    this.privateKey = null;
    this.localKey = null;
    this.publicKeyBytes = null;
  }

  /** Encrypt for storage on this device. */
  encryptLocal(data: Uint8Array): Uint8Array {
    if (this.localKey === null) throw noKeys();
    return sealLocal(this.localKey, data, this.random);
  }

  /** Decrypt data produced by encryptLocal under this identity. */
  decryptLocal(envelope: Uint8Array): Uint8Array {
    if (this.localKey === null) throw noKeys();
    return openLocal(this.localKey, envelope);
  }

  /** Encrypt to a recipient's X25519 public key (32 raw bytes). */
  encryptFor(recipientPublicKey: Uint8Array, data: Uint8Array): Uint8Array {
    return sealTo(recipientPublicKey, data, this.random);
  }

  /** Decrypt data that was encrypted to our public key. */
  decrypt(envelope: Uint8Array): Uint8Array {
    if (this.privateKey === null) throw noKeys();
    return openFrom(this.privateKey, envelope);
  }

  private async deriveAndStore(
    mnemonic: string,
    passphrase: string,
  ): Promise<void> {
    const seed = mnemonicToSeed(mnemonic, passphrase);
    const { publicKey } = deriveIdentityKeyPair(seed);
    try {
      await Promise.all([
        this.storage.setItem(this.seedTag, base64.encode(seed)),
        this.storage.setItem(this.publicKeyTag, base64.encode(publicKey)),
      ]);
    } catch (error) {
      throw new CryptoError("STORAGE_FAILED", storageMessage("store", error));
    }
    this.useSeed(seed);
  }

  private useSeed(seed: Uint8Array): void {
    const identity = deriveIdentityKeyPair(seed);
    this.privateKey = identity.privateKey;
    this.publicKeyBytes = identity.publicKey;
    this.localKey = deriveLocalKey(seed);
  }

  private async readItem(key: string): Promise<string | null> {
    try {
      return await this.storage.getItem(key);
    } catch (error) {
      throw new CryptoError("STORAGE_FAILED", storageMessage("read", error));
    }
  }
}

function decodeSeed(stored: string): Uint8Array {
  let seed: Uint8Array;
  try {
    seed = base64.decode(stored);
  } catch {
    throw new CryptoError("BAD_FORMAT", "Stored seed is not valid base64");
  }
  if (seed.length !== SEED_LENGTH) {
    throw new CryptoError(
      "BAD_FORMAT",
      `Stored seed must be ${SEED_LENGTH} bytes, got ${seed.length}`,
    );
  }
  return seed;
}

function noKeys(): CryptoError {
  return new CryptoError(
    "NO_KEYS",
    "No keys loaded: call generate(), recover(), or load() first",
  );
}

function storageMessage(action: string, error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `Key storage failed to ${action}: ${detail}`;
}
