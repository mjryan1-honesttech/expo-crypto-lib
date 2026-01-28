/**
 * Node adapter: storage get/set/remove and getRandomValues behavior.
 */

import { createNodeKeyStorage, createNodeRandomValues } from "../index";

describe("nodeAdapter", () => {
  describe("createNodeKeyStorage", () => {
    it("persists and retrieves values within same instance", async () => {
      const storage = createNodeKeyStorage();
      await storage.setItem("k1", "v1");
      expect(await storage.getItem("k1")).toBe("v1");
      expect(await storage.getItem("missing")).toBeNull();
    });

    it("removeItem removes the key", async () => {
      const storage = createNodeKeyStorage();
      await storage.setItem("k1", "v1");
      await storage.removeItem("k1");
      expect(await storage.getItem("k1")).toBeNull();
    });

    it("setItem overwrites existing value", async () => {
      const storage = createNodeKeyStorage();
      await storage.setItem("k1", "v1");
      await storage.setItem("k1", "v2");
      expect(await storage.getItem("k1")).toBe("v2");
    });
  });

  describe("createNodeRandomValues", () => {
    it("getRandomValues fills the array", () => {
      const rng = createNodeRandomValues();
      const arr = new Uint8Array(32);
      const out = rng.getRandomValues(arr);
      expect(out).toBe(arr);
      const zeros = new Uint8Array(32);
      expect(arr.every((b, i) => b === zeros[i])).toBe(false);
    });

    it("getRandomValues returns same reference for null", () => {
      const rng = createNodeRandomValues();
      expect(rng.getRandomValues(null)).toBeNull();
    });
  });
});
