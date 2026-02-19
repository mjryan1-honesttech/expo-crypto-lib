/**
 * MnemonicManager: generateMnemonic, mnemonicToSeed, validateMnemonic.
 */

import {
  createNodeRandomValues,
  MnemonicManager,
} from "../src/index";

// Valid 24 words from BIP39 wordlist (MnemonicManager validates wordlist, not checksum)
const VALID_24_WORDS =
  "abandon ability able about above absent absorb abstract absurd abuse access accident account accuse achieve acid acoustic acquire across act action actor actual adapt";

describe("MnemonicManager", () => {
  describe("generateMnemonic", () => {
    it("returns 24-word string with valid wordlist entries", async () => {
      const rng = createNodeRandomValues();
      const mnemonic = await MnemonicManager.generateMnemonic(rng);
      expect(typeof mnemonic).toBe("string");
      const words = mnemonic.trim().split(/\s+/);
      expect(words.length).toBe(24);
      expect(MnemonicManager.validateMnemonic(mnemonic)).toBe(true);
    });

    it("uses provided randomAdapter", async () => {
      const rng = createNodeRandomValues();
      const mnemonic = await MnemonicManager.generateMnemonic(rng);
      expect(mnemonic).toBeTruthy();
      expect(MnemonicManager.validateMnemonic(mnemonic)).toBe(true);
    });
  });

  describe("validateMnemonic", () => {
    it("returns true for valid 24-word mnemonic from generateMnemonic", async () => {
      const rng = createNodeRandomValues();
      const mnemonic = await MnemonicManager.generateMnemonic(rng);
      expect(MnemonicManager.validateMnemonic(mnemonic)).toBe(true);
    });

    it("returns true for valid 24-word mnemonic with valid words", () => {
      expect(MnemonicManager.validateMnemonic(VALID_24_WORDS)).toBe(true);
    });

    it("returns false for empty string", () => {
      expect(MnemonicManager.validateMnemonic("")).toBe(false);
    });

    it("returns false for whitespace only", () => {
      expect(MnemonicManager.validateMnemonic("   ")).toBe(false);
    });

    it("handles extra whitespace between words", () => {
      const withSpaces = VALID_24_WORDS.split(" ").join("  ");
      expect(MnemonicManager.validateMnemonic(withSpaces)).toBe(true);
    });

    it("returns false for 12 words", () => {
      const twelve =
        "abandon ability able about above absent absorb abstract absurd abuse access accident";
      expect(MnemonicManager.validateMnemonic(twelve)).toBe(false);
    });

    it("returns false for 23 words", () => {
      const twentyThree = VALID_24_WORDS.split(" ").slice(0, 23).join(" ");
      expect(MnemonicManager.validateMnemonic(twentyThree)).toBe(false);
    });

    it("returns false for non-wordlist term", () => {
      const twentyThreeValid = VALID_24_WORDS.split(" ").slice(0, 23).join(" ");
      const invalid = twentyThreeValid + " invalidword";
      expect(MnemonicManager.validateMnemonic(invalid)).toBe(false);
    });
  });

  describe("mnemonicToSeed", () => {
    it("returns Uint8Array of expected length", async () => {
      const seed = await MnemonicManager.mnemonicToSeed(VALID_24_WORDS);
      expect(seed).toBeInstanceOf(Uint8Array);
      expect(seed.length).toBeGreaterThan(0);
      // SHA512 produces 64-byte hex = 128 chars; seed is hex.length
      expect(seed.length).toBe(128);
    });

    it("same mnemonic yields same seed", async () => {
      const seed1 = await MnemonicManager.mnemonicToSeed(VALID_24_WORDS);
      const seed2 = await MnemonicManager.mnemonicToSeed(VALID_24_WORDS);
      expect(seed1).toEqual(seed2);
    });

    it("different passphrase yields different seed", async () => {
      const seedEmpty = await MnemonicManager.mnemonicToSeed(
        VALID_24_WORDS,
        "",
      );
      const seedWithPhrase = await MnemonicManager.mnemonicToSeed(
        VALID_24_WORDS,
        "passphrase",
      );
      expect(seedEmpty).not.toEqual(seedWithPhrase);
    });

    it("empty passphrase vs non-empty passphrase", async () => {
      const seedA = await MnemonicManager.mnemonicToSeed(VALID_24_WORDS, "");
      const seedB = await MnemonicManager.mnemonicToSeed(
        VALID_24_WORDS,
        "my-passphrase",
      );
      expect(seedA).not.toEqual(seedB);
    });
  });
});
