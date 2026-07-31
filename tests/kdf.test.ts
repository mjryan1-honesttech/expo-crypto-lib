/**
 * Key derivation: verified against the official BIP39 test vectors
 * (trezor/python-mnemonic vectors.json, English, passphrase "TREZOR").
 */

import { CryptoError } from "../src/errors";
import { createNodeRandomValues } from "../src/index";
import {
  deriveIdentityKeyPair,
  deriveLocalKey,
  generateMnemonicPhrase,
  mnemonicToSeed,
  validateMnemonicPhrase,
} from "../src/kdf";

/** [entropy, mnemonic, seed] triples for the 24-word English vectors. */
const VECTORS: [string, string, string][] = [
  [
    "0000000000000000000000000000000000000000000000000000000000000000",
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art",
    "bda85446c68413707090a52022edd26a1c9462295029f2e60cd7c4f2bbd3097170af7a4d73245cafa9c3cca8d561a7c3de6f5d4a10be8ed2a5e608d68f92fcc8",
  ],
  [
    "7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f",
    "legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth title",
    "bc09fca1804f7e69da93c2f2028eb238c227f2e9dda30cd63699232578480a4021b146ad717fbb7e451ce9eb835f43620bf5c514db0f8add49f5d121449d3e87",
  ],
  [
    "f585c11aec520db57dd353c69554b21a89b20fb0650966fa0a9d6f74fd989d8f",
    "void come effort suffer camp survey warrior heavy shoot primary clutch crush open amazing screen patrol group space point ten exist slush involve unfold",
    "01f5bced59dec48e362f2c45b5de68b9fd6c92c6634f44d6d40aab69056506f0e35524a518034ddc1192e1dacd32c1ed3eaa3c3b131c88ed8e7e54c49a5d0998",
  ],
];

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("kdf", () => {
  describe("mnemonicToSeed", () => {
    it.each(VECTORS)(
      "matches the official BIP39 seed vector (%s)",
      (_entropy, mnemonic, expectedSeed) => {
        expect(toHex(mnemonicToSeed(mnemonic, "TREZOR"))).toBe(expectedSeed);
      },
    );

    it("returns a 64-byte seed", () => {
      expect(mnemonicToSeed(VECTORS[0][1]).length).toBe(64);
    });

    it("collapses incidental whitespace", () => {
      const spaced = VECTORS[0][1].split(" ").join("   ");
      expect(toHex(mnemonicToSeed(spaced, "TREZOR"))).toBe(VECTORS[0][2]);
    });

    it("different passphrase yields a different seed", () => {
      expect(toHex(mnemonicToSeed(VECTORS[0][1], ""))).not.toBe(
        toHex(mnemonicToSeed(VECTORS[0][1], "TREZOR")),
      );
    });

    it("throws INVALID_MNEMONIC rather than deriving a key from a bad phrase", () => {
      expect(() => mnemonicToSeed("not a real phrase")).toThrow(CryptoError);
      try {
        mnemonicToSeed("not a real phrase");
      } catch (error) {
        expect((error as CryptoError).code).toBe("INVALID_MNEMONIC");
      }
    });
  });

  describe("validateMnemonicPhrase", () => {
    it("accepts the official vectors", () => {
      for (const [, mnemonic] of VECTORS) {
        expect(validateMnemonicPhrase(mnemonic)).toBe(true);
      }
    });

    // The v1 wordlist had no checksum, so a typo onto another valid word
    // silently derived a different key. This is the regression guard.
    it("rejects a single-word typo that lands on another real word", () => {
      const words = VECTORS[0][1].split(" ");
      words[0] = "ability";
      expect(validateMnemonicPhrase(words.join(" "))).toBe(false);
    });

    it("rejects a swapped word pair (checksum catches reordering)", () => {
      const words = VECTORS[2][1].split(" ");
      [words[0], words[1]] = [words[1], words[0]];
      expect(validateMnemonicPhrase(words.join(" "))).toBe(false);
    });

    it("rejects a word that is not in the wordlist", () => {
      const words = VECTORS[0][1].split(" ");
      words[5] = "voyal";
      expect(validateMnemonicPhrase(words.join(" "))).toBe(false);
    });

    it("rejects wrong word counts and empty input", () => {
      expect(validateMnemonicPhrase("")).toBe(false);
      expect(validateMnemonicPhrase("   ")).toBe(false);
      expect(
        validateMnemonicPhrase(VECTORS[0][1].split(" ").slice(0, 23).join(" ")),
      ).toBe(false);
    });
  });

  describe("generateMnemonicPhrase", () => {
    it("produces 24 words that validate", () => {
      const mnemonic = generateMnemonicPhrase(createNodeRandomValues());
      expect(mnemonic.split(" ").length).toBe(24);
      expect(validateMnemonicPhrase(mnemonic)).toBe(true);
    });

    it("produces a different phrase each time", () => {
      const random = createNodeRandomValues();
      const seen = new Set(
        Array.from({ length: 25 }, () => generateMnemonicPhrase(random)),
      );
      expect(seen.size).toBe(25);
    });

    // v1 packed the last word from only 3 bits, so word 24 was always one of
    // the first 8 wordlist entries. Over many phrases the real distribution is wide.
    it("does not confine the last word to a handful of values", () => {
      const random = createNodeRandomValues();
      const lastWords = new Set(
        Array.from({ length: 200 }, () => {
          const words = generateMnemonicPhrase(random).split(" ");
          return words[words.length - 1];
        }),
      );
      expect(lastWords.size).toBeGreaterThan(8);
    });
  });

  describe("key derivation", () => {
    it("derives a 32-byte X25519 keypair deterministically", () => {
      const seed = mnemonicToSeed(VECTORS[0][1]);
      const a = deriveIdentityKeyPair(seed);
      const b = deriveIdentityKeyPair(seed);
      expect(a.privateKey.length).toBe(32);
      expect(a.publicKey.length).toBe(32);
      expect(toHex(a.publicKey)).toBe(toHex(b.publicKey));
    });

    it("derives different identities from different phrases", () => {
      const a = deriveIdentityKeyPair(mnemonicToSeed(VECTORS[0][1]));
      const b = deriveIdentityKeyPair(mnemonicToSeed(VECTORS[1][1]));
      expect(toHex(a.publicKey)).not.toBe(toHex(b.publicKey));
    });

    it("local key is 32 bytes, deterministic, and distinct from the identity key", () => {
      const seed = mnemonicToSeed(VECTORS[0][1]);
      const local = deriveLocalKey(seed);
      expect(local.length).toBe(32);
      expect(toHex(local)).toBe(toHex(deriveLocalKey(seed)));
      expect(toHex(local)).not.toBe(
        toHex(deriveIdentityKeyPair(seed).privateKey),
      );
    });

    it("derivation is fast enough to run on device", () => {
      const seed = mnemonicToSeed(VECTORS[0][1]);
      const start = Date.now();
      deriveIdentityKeyPair(seed);
      expect(Date.now() - start).toBeLessThan(50);
    });
  });
});
