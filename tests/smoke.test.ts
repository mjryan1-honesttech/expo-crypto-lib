/**
 * Smoke test: library loads and node adapter + MnemonicManager work in Node (no native deps).
 */

import {
  createNodeKeyStorage,
  createNodeRandomValues,
  createRSAManager,
  EnhancedRSAManager,
  MnemonicManager,
} from "../src/index";

describe("smoke", () => {
  it("exports EnhancedRSAManager, createRSAManager, MnemonicManager, createNodeKeyStorage, createNodeRandomValues", () => {
    expect(EnhancedRSAManager).toBeDefined();
    expect(createRSAManager).toBeDefined();
    expect(MnemonicManager).toBeDefined();
    expect(createNodeKeyStorage).toBeDefined();
    expect(createNodeRandomValues).toBeDefined();
  });

  it("exposes node adapter with getItem, setItem, removeItem", () => {
    const storage = createNodeKeyStorage();
    expect(storage).toBeDefined();
    expect(typeof storage.getItem).toBe("function");
    expect(typeof storage.setItem).toBe("function");
    expect(typeof storage.removeItem).toBe("function");
  });

  it("exposes createNodeRandomValues with getRandomValues", () => {
    const rng = createNodeRandomValues();
    expect(rng).toBeDefined();
    expect(typeof rng.getRandomValues).toBe("function");
  });

  it("MnemonicManager has validateMnemonic", () => {
    expect(MnemonicManager.validateMnemonic).toBeDefined();
    expect(typeof MnemonicManager.validateMnemonic).toBe("function");
    expect(MnemonicManager.validateMnemonic("not valid words")).toBe(false);
  });

  it("MnemonicManager.generateMnemonic returns string", async () => {
    const mnemonic = await MnemonicManager.generateMnemonic(
      createNodeRandomValues(),
    );
    expect(typeof mnemonic).toBe("string");
    expect(mnemonic.length).toBeGreaterThan(0);
  });

  it("MnemonicManager.mnemonicToSeed returns Uint8Array", async () => {
    const words =
      "abandon ability able about above absent absorb abstract absurd abuse access accident account accuse achieve acid acoustic acquire across act action actor actual adapt";
    const seed = await MnemonicManager.mnemonicToSeed(words);
    expect(seed).toBeInstanceOf(Uint8Array);
    expect(seed.length).toBeGreaterThan(0);
  });
});
