/**
 * Smoke test: library loads and node adapter + MnemonicManager work in Node (no native deps).
 */

import {
  createNodeKeyStorage,
  createNodeRandomValues,
  MnemonicManager,
} from "../index";

describe("smoke", () => {
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
});
