/**
 * HPKE (RFC 9180) base mode, single-shot seal/open.
 *
 * Cipher suite: DHKEM(X25519, HKDF-SHA256) / HKDF-SHA256 / ChaCha20Poly1305
 *   kem_id = 0x0020, kdf_id = 0x0001, aead_id = 0x0003
 *
 * Implemented on pure-JS primitives because hpke-js is built on WebCrypto, and
 * `crypto.subtle` is unavailable on Hermes/Expo Go. Verified against the
 * RFC 9180 Appendix A.2 test vectors in tests/hpke.test.ts.
 */

import { chacha20poly1305 } from "@noble/ciphers/chacha";
import { x25519 } from "@noble/curves/ed25519";
import { expand, extract } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";

import type { IRandomValues } from "./adapters/types";
import { CryptoError } from "./errors";

const KEM_ID = 0x0020;
const KDF_ID = 0x0001;
const AEAD_ID = 0x0003;

const MODE_BASE = 0x00;

/** Suite constants: KEM shared secret, AEAD key, AEAD nonce, hash output. */
const N_SECRET = 32;
const N_K = 32;
const N_N = 12;
const N_H = 32;

/** Serialized X25519 public key length, i.e. the KEM `enc` length. */
export const N_ENC = 32;

const utf8 = new TextEncoder();

const HPKE_V1 = utf8.encode("HPKE-v1");
const KEM_SUITE_ID = concat(utf8.encode("KEM"), i2osp2(KEM_ID));
const HPKE_SUITE_ID = concat(
  utf8.encode("HPKE"),
  i2osp2(KEM_ID),
  i2osp2(KDF_ID),
  i2osp2(AEAD_ID),
);

export interface Encapsulation {
  /** Serialized ephemeral public key, sent alongside the ciphertext. */
  enc: Uint8Array;
  sharedSecret: Uint8Array;
}

/**
 * Seal to a recipient public key. Returns the ephemeral public key and the
 * AEAD ciphertext (which includes the 16-byte tag).
 */
export function seal(
  recipientPublicKey: Uint8Array,
  plaintext: Uint8Array,
  aad: Uint8Array,
  random: IRandomValues,
  info: Uint8Array = new Uint8Array(0),
): { enc: Uint8Array; ciphertext: Uint8Array } {
  const ephemeralPrivateKey = random.getRandomValues(new Uint8Array(32));
  const { enc, sharedSecret } = encap(recipientPublicKey, ephemeralPrivateKey);
  const { key, nonce } = keySchedule(sharedSecret, info);
  const ciphertext = chacha20poly1305(key, nonce, aad).encrypt(plaintext);
  return { enc, ciphertext };
}

/** Open a ciphertext addressed to `recipientPrivateKey`. */
export function open(
  recipientPrivateKey: Uint8Array,
  enc: Uint8Array,
  ciphertext: Uint8Array,
  aad: Uint8Array,
  info: Uint8Array = new Uint8Array(0),
): Uint8Array {
  const sharedSecret = decap(enc, recipientPrivateKey);
  const { key, nonce } = keySchedule(sharedSecret, info);
  try {
    return chacha20poly1305(key, nonce, aad).decrypt(ciphertext);
  } catch {
    throw new CryptoError(
      "AUTH_FAILED",
      "HPKE open failed: wrong recipient key, or the message was modified",
    );
  }
}

/**
 * KEM encapsulation. The ephemeral private key is a parameter rather than
 * generated here so the RFC 9180 vectors (which fix skEm) can be replayed.
 */
export function encap(
  recipientPublicKey: Uint8Array,
  ephemeralPrivateKey: Uint8Array,
): Encapsulation {
  if (recipientPublicKey.length !== N_ENC) {
    throw new CryptoError(
      "BAD_FORMAT",
      `Recipient public key must be ${N_ENC} bytes, got ${recipientPublicKey.length}`,
    );
  }
  const enc = x25519.getPublicKey(ephemeralPrivateKey);
  const dh = sharedSecretOrThrow(ephemeralPrivateKey, recipientPublicKey);
  return {
    enc,
    sharedSecret: extractAndExpand(dh, concat(enc, recipientPublicKey)),
  };
}

/** KEM decapsulation. */
export function decap(
  enc: Uint8Array,
  recipientPrivateKey: Uint8Array,
): Uint8Array {
  if (enc.length !== N_ENC) {
    throw new CryptoError(
      "BAD_FORMAT",
      `Encapsulated key must be ${N_ENC} bytes, got ${enc.length}`,
    );
  }
  const dh = sharedSecretOrThrow(recipientPrivateKey, enc);
  const recipientPublicKey = x25519.getPublicKey(recipientPrivateKey);
  return extractAndExpand(dh, concat(enc, recipientPublicKey));
}

/**
 * RFC 9180 KeySchedule for mode_base with an empty PSK. Exported for the
 * vector tests; `seq` is always 0 here because each envelope carries one message.
 */
export function keySchedule(
  sharedSecret: Uint8Array,
  info: Uint8Array,
): { key: Uint8Array; nonce: Uint8Array; exporterSecret: Uint8Array } {
  const empty = new Uint8Array(0);
  const pskIdHash = labeledExtract(empty, "psk_id_hash", empty, HPKE_SUITE_ID);
  const infoHash = labeledExtract(empty, "info_hash", info, HPKE_SUITE_ID);
  const context = concat(new Uint8Array([MODE_BASE]), pskIdHash, infoHash);

  const secret = labeledExtract(sharedSecret, "secret", empty, HPKE_SUITE_ID);
  return {
    key: labeledExpand(secret, "key", context, N_K, HPKE_SUITE_ID),
    nonce: labeledExpand(secret, "base_nonce", context, N_N, HPKE_SUITE_ID),
    exporterSecret: labeledExpand(secret, "exp", context, N_H, HPKE_SUITE_ID),
  };
}

function extractAndExpand(dh: Uint8Array, kemContext: Uint8Array): Uint8Array {
  const eaePrk = labeledExtract(new Uint8Array(0), "eae_prk", dh, KEM_SUITE_ID);
  return labeledExpand(
    eaePrk,
    "shared_secret",
    kemContext,
    N_SECRET,
    KEM_SUITE_ID,
  );
}

function labeledExtract(
  salt: Uint8Array,
  label: string,
  ikm: Uint8Array,
  suiteId: Uint8Array,
): Uint8Array {
  return extract(
    sha256,
    concat(HPKE_V1, suiteId, utf8.encode(label), ikm),
    salt,
  );
}

function labeledExpand(
  prk: Uint8Array,
  label: string,
  info: Uint8Array,
  length: number,
  suiteId: Uint8Array,
): Uint8Array {
  return expand(
    sha256,
    prk,
    concat(i2osp2(length), HPKE_V1, suiteId, utf8.encode(label), info),
    length,
  );
}

/** X25519 rejects an all-zero shared secret (RFC 7748 contributory behaviour). */
function sharedSecretOrThrow(
  privateKey: Uint8Array,
  publicKey: Uint8Array,
): Uint8Array {
  try {
    return x25519.getSharedSecret(privateKey, publicKey);
  } catch {
    throw new CryptoError(
      "BAD_FORMAT",
      "X25519 key exchange failed: the peer public key is not a valid point",
    );
  }
}

/** I2OSP(n, 2): two-byte big-endian integer. */
function i2osp2(n: number): Uint8Array {
  return new Uint8Array([(n >> 8) & 0xff, n & 0xff]);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  let length = 0;
  for (const part of parts) length += part.length;
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
