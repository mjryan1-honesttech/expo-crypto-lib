/**
 * Typed errors. Every failure path throws one of these instead of returning null,
 * so callers can tell "no keys yet" apart from "ciphertext was tampered with".
 */

export type CryptoErrorCode =
  /** No keypair in storage — call generate() or recover() first. */
  | "NO_KEYS"
  /** AEAD tag check failed: wrong key, or the ciphertext was modified. */
  | "AUTH_FAILED"
  /** Envelope is truncated or structurally invalid. */
  | "BAD_FORMAT"
  /** Envelope version byte is not one this build understands. */
  | "UNSUPPORTED_VERSION"
  /** Mnemonic is not a valid BIP39 phrase (wrong length, unknown word, or bad checksum). */
  | "INVALID_MNEMONIC"
  /** The underlying key storage rejected or failed the operation. */
  | "STORAGE_FAILED"
  /** Value exceeds what the platform's secure storage accepts. */
  | "VALUE_TOO_LARGE";

export class CryptoError extends Error {
  readonly code: CryptoErrorCode;

  constructor(code: CryptoErrorCode, message: string) {
    super(message);
    this.name = "CryptoError";
    this.code = code;
  }
}
