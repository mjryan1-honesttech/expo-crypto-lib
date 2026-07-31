/**
 * Envelope format. Every ciphertext is self-describing and its header is
 * authenticated, so a version or mode cannot be swapped without detection.
 *
 *   byte 0   version (0x02)
 *   byte 1   mode: 0x00 local, 0x01 hpke
 *   mode 0x00: nonce(24) || ciphertext+tag      XChaCha20-Poly1305 under the local key
 *   mode 0x01: enc(32)   || ciphertext+tag      HPKE base mode to a public key
 *
 * The two header bytes are passed as AEAD associated data.
 */

import { xchacha20poly1305 } from "@noble/ciphers/chacha";

import type { IRandomValues } from "./adapters/types";
import { CryptoError } from "./errors";
import { N_ENC, open as hpkeOpen, seal as hpkeSeal } from "./hpke";

export const VERSION = 0x02;

export const MODE_LOCAL = 0x00;
export const MODE_HPKE = 0x01;

const HEADER_LENGTH = 2;
const NONCE_LENGTH = 24;
const TAG_LENGTH = 16;

/** Encrypt for storage on this device, under the seed-derived local key. */
export function sealLocal(
  localKey: Uint8Array,
  plaintext: Uint8Array,
  random: IRandomValues,
): Uint8Array {
  const nonce = random.getRandomValues(new Uint8Array(NONCE_LENGTH));
  const header = headerBytes(MODE_LOCAL);
  const ciphertext = xchacha20poly1305(localKey, nonce, header).encrypt(
    plaintext,
  );
  return concat(header, nonce, ciphertext);
}

/** Decrypt an envelope produced by sealLocal. */
export function openLocal(
  localKey: Uint8Array,
  envelope: Uint8Array,
): Uint8Array {
  const body = parse(envelope, MODE_LOCAL, NONCE_LENGTH);
  const nonce = body.subarray(0, NONCE_LENGTH);
  const ciphertext = body.subarray(NONCE_LENGTH);
  try {
    return xchacha20poly1305(localKey, nonce, headerBytes(MODE_LOCAL)).decrypt(
      ciphertext,
    );
  } catch {
    throw new CryptoError(
      "AUTH_FAILED",
      "Decryption failed: wrong key, or the data was modified",
    );
  }
}

/** Encrypt to a recipient's X25519 public key. */
export function sealTo(
  recipientPublicKey: Uint8Array,
  plaintext: Uint8Array,
  random: IRandomValues,
): Uint8Array {
  const header = headerBytes(MODE_HPKE);
  const { enc, ciphertext } = hpkeSeal(
    recipientPublicKey,
    plaintext,
    header,
    random,
  );
  return concat(header, enc, ciphertext);
}

/** Decrypt an envelope produced by sealTo, using our own private key. */
export function openFrom(
  privateKey: Uint8Array,
  envelope: Uint8Array,
): Uint8Array {
  const body = parse(envelope, MODE_HPKE, N_ENC);
  return hpkeOpen(
    privateKey,
    body.subarray(0, N_ENC),
    body.subarray(N_ENC),
    headerBytes(MODE_HPKE),
  );
}

/** The mode byte of a well-formed envelope, for callers that route on it. */
export function readMode(envelope: Uint8Array): number {
  checkHeader(envelope);
  return envelope[1];
}

function headerBytes(mode: number): Uint8Array {
  return new Uint8Array([VERSION, mode]);
}

/** Validate the header and return the body, or throw a specific error. */
function parse(
  envelope: Uint8Array,
  expectedMode: number,
  prefixLength: number,
): Uint8Array {
  checkHeader(envelope);
  if (envelope[1] !== expectedMode) {
    throw new CryptoError(
      "BAD_FORMAT",
      `Envelope mode ${envelope[1]} does not match the requested operation (expected ${expectedMode})`,
    );
  }
  const minimum = HEADER_LENGTH + prefixLength + TAG_LENGTH;
  if (envelope.length < minimum) {
    throw new CryptoError(
      "BAD_FORMAT",
      `Envelope is truncated: expected at least ${minimum} bytes, got ${envelope.length}`,
    );
  }
  return envelope.subarray(HEADER_LENGTH);
}

function checkHeader(envelope: Uint8Array): void {
  if (envelope.length < HEADER_LENGTH) {
    throw new CryptoError(
      "BAD_FORMAT",
      "Envelope is too short to have a header",
    );
  }
  if (envelope[0] !== VERSION) {
    throw new CryptoError(
      "UNSUPPORTED_VERSION",
      `Unsupported envelope version 0x${envelope[0].toString(16).padStart(2, "0")}; this build reads 0x02`,
    );
  }
  if (envelope[1] !== MODE_LOCAL && envelope[1] !== MODE_HPKE) {
    throw new CryptoError(
      "BAD_FORMAT",
      `Unknown envelope mode 0x${envelope[1].toString(16).padStart(2, "0")}`,
    );
  }
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
