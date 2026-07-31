/**
 * Envelope framing: round-trips, and a specific error for every way an
 * envelope can be wrong. Nothing here may fail silently.
 */

import { createNodeRandomValues } from "../src/adapters/nodeAdapter";
import {
  MODE_HPKE,
  MODE_LOCAL,
  VERSION,
  openFrom,
  openLocal,
  readMode,
  sealLocal,
  sealTo,
} from "../src/envelope";
import { CryptoError } from "../src/errors";
import {
  deriveIdentityKeyPair,
  deriveLocalKey,
  mnemonicToSeed,
} from "../src/kdf";

const MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";

const random = createNodeRandomValues();
const seed = mnemonicToSeed(MNEMONIC);
const localKey = deriveLocalKey(seed);
const identity = deriveIdentityKeyPair(seed);

const SIZES: [string, number][] = [
  ["empty", 0],
  ["1 byte", 1],
  ["1 KB", 1024],
  ["1 MB", 1024 * 1024],
];

function expectCode(run: () => unknown, code: string): void {
  expect(run).toThrow(CryptoError);
  try {
    run();
  } catch (error) {
    expect((error as CryptoError).code).toBe(code);
  }
}

function payload(size: number): Uint8Array {
  const data = new Uint8Array(size);
  for (let i = 0; i < size; i++) data[i] = i & 0xff;
  return data;
}

describe("envelope", () => {
  describe("local mode", () => {
    it.each(SIZES)("round-trips %s", (_label, size) => {
      const data = payload(size);
      const sealed = sealLocal(localKey, data, random);
      expect(openLocal(localKey, sealed)).toEqual(data);
    });

    it("writes the version and mode header", () => {
      const sealed = sealLocal(localKey, payload(4), random);
      expect(sealed[0]).toBe(VERSION);
      expect(sealed[1]).toBe(MODE_LOCAL);
      expect(readMode(sealed)).toBe(MODE_LOCAL);
    });

    it("uses a fresh nonce per message", () => {
      const data = payload(16);
      const a = sealLocal(localKey, data, random);
      const b = sealLocal(localKey, data, random);
      expect(Array.from(a)).not.toEqual(Array.from(b));
    });

    it("overhead is header + nonce + tag", () => {
      expect(sealLocal(localKey, payload(0), random).length).toBe(2 + 24 + 16);
    });

    it("throws AUTH_FAILED for a wrong key", () => {
      const sealed = sealLocal(localKey, payload(8), random);
      const otherKey = deriveLocalKey(mnemonicToSeed(MNEMONIC, "different"));
      expectCode(() => openLocal(otherKey, sealed), "AUTH_FAILED");
    });
  });

  describe("hpke mode", () => {
    it.each(SIZES)("round-trips %s", (_label, size) => {
      const data = payload(size);
      const sealed = sealTo(identity.publicKey, data, random);
      expect(openFrom(identity.privateKey, sealed)).toEqual(data);
    });

    it("writes the version and mode header", () => {
      const sealed = sealTo(identity.publicKey, payload(4), random);
      expect(sealed[0]).toBe(VERSION);
      expect(sealed[1]).toBe(MODE_HPKE);
      expect(readMode(sealed)).toBe(MODE_HPKE);
    });

    it("overhead is header + enc + tag", () => {
      expect(sealTo(identity.publicKey, payload(0), random).length).toBe(
        2 + 32 + 16,
      );
    });
  });

  describe("tamper detection", () => {
    // Each region is mutated independently: nothing may decrypt anyway.
    it("rejects a flipped bit anywhere in a local envelope", () => {
      const original = sealLocal(localKey, payload(64), random);
      for (let i = 2; i < original.length; i++) {
        const mutated = new Uint8Array(original);
        mutated[i] ^= 0x01;
        expectCode(() => openLocal(localKey, mutated), "AUTH_FAILED");
      }
    });

    it("rejects a flipped bit anywhere in an hpke envelope", () => {
      const original = sealTo(identity.publicKey, payload(64), random);
      for (let i = 2; i < original.length; i++) {
        const mutated = new Uint8Array(original);
        mutated[i] ^= 0x01;
        expect(() => openFrom(identity.privateKey, mutated)).toThrow(
          CryptoError,
        );
      }
    });

    it("rejects a truncated envelope", () => {
      const sealed = sealLocal(localKey, payload(32), random);
      expectCode(
        () => openLocal(localKey, sealed.subarray(0, 20)),
        "BAD_FORMAT",
      );
    });

    it("rejects appended trailing bytes", () => {
      const sealed = sealLocal(localKey, payload(32), random);
      const extended = new Uint8Array(sealed.length + 1);
      extended.set(sealed);
      expectCode(() => openLocal(localKey, extended), "AUTH_FAILED");
    });
  });

  describe("header validation", () => {
    it("throws UNSUPPORTED_VERSION for another version byte", () => {
      const sealed = sealLocal(localKey, payload(8), random);
      sealed[0] = 0x01;
      expectCode(() => openLocal(localKey, sealed), "UNSUPPORTED_VERSION");
      expectCode(() => readMode(sealed), "UNSUPPORTED_VERSION");
    });

    it("throws BAD_FORMAT for an unknown mode byte", () => {
      const sealed = sealLocal(localKey, payload(8), random);
      sealed[1] = 0x7f;
      expectCode(() => openLocal(localKey, sealed), "BAD_FORMAT");
    });

    // The header is the AEAD's associated data, so swapping modes cannot pass.
    it("throws BAD_FORMAT when a local envelope is opened as hpke", () => {
      const sealed = sealLocal(localKey, payload(8), random);
      expectCode(() => openFrom(identity.privateKey, sealed), "BAD_FORMAT");
    });

    it("throws BAD_FORMAT when an hpke envelope is opened as local", () => {
      const sealed = sealTo(identity.publicKey, payload(8), random);
      expectCode(() => openLocal(localKey, sealed), "BAD_FORMAT");
    });

    it("throws BAD_FORMAT for input too short to hold a header", () => {
      expectCode(
        () => openLocal(localKey, new Uint8Array([VERSION])),
        "BAD_FORMAT",
      );
      expectCode(() => readMode(new Uint8Array(0)), "BAD_FORMAT");
    });
  });
});
