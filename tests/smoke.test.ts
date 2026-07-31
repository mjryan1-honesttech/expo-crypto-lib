/**
 * Smoke test: the library loads and works in Node with no native dependencies.
 */

import {
  CryptoError,
  CryptoManager,
  createCryptoManager,
  createNodeKeyStorage,
  createNodeRandomValues,
  generateMnemonicPhrase,
  mnemonicToSeed,
  validateMnemonicPhrase,
} from "../src/index";

const VALID_24_WORDS =
  "void come effort suffer camp survey warrior heavy shoot primary clutch crush open amazing screen patrol group space point ten exist slush involve unfold";

describe("smoke", () => {
  it("exports the manager, factory, adapters, and error type", () => {
    expect(CryptoManager).toBeDefined();
    expect(createCryptoManager).toBeDefined();
    expect(CryptoError).toBeDefined();
    expect(createNodeKeyStorage).toBeDefined();
    expect(createNodeRandomValues).toBeDefined();
  });

  it("exposes node adapter with getItem, setItem, removeItem", () => {
    const storage = createNodeKeyStorage();
    expect(typeof storage.getItem).toBe("function");
    expect(typeof storage.setItem).toBe("function");
    expect(typeof storage.removeItem).toBe("function");
  });

  it("exposes createNodeRandomValues with getRandomValues", () => {
    expect(typeof createNodeRandomValues().getRandomValues).toBe("function");
  });

  it("validates a real BIP39 phrase and rejects nonsense", () => {
    expect(validateMnemonicPhrase(VALID_24_WORDS)).toBe(true);
    expect(validateMnemonicPhrase("not valid words")).toBe(false);
  });

  it("generateMnemonicPhrase returns 24 valid words", () => {
    const mnemonic = generateMnemonicPhrase(createNodeRandomValues());
    expect(mnemonic.split(" ").length).toBe(24);
    expect(validateMnemonicPhrase(mnemonic)).toBe(true);
  });

  it("mnemonicToSeed returns a 64-byte Uint8Array", () => {
    const seed = mnemonicToSeed(VALID_24_WORDS);
    expect(seed).toBeInstanceOf(Uint8Array);
    expect(seed.length).toBe(64);
  });

  it("encrypts and decrypts end to end", async () => {
    const manager = createCryptoManager({ platform: "node" });
    await manager.generate();
    const data = new TextEncoder().encode("hello");
    expect(manager.decryptLocal(manager.encryptLocal(data))).toEqual(data);
  });
});
