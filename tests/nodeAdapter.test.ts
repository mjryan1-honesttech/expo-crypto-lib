/**
 * Node adapter: storage get/set/remove and getRandomValues behavior.
 */

import { createNodeKeyStorage, createNodeRandomValues } from "../src/index";

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

    it("getItem for key that was never set returns null", async () => {
      const storage = createNodeKeyStorage();
      expect(await storage.getItem("never-set")).toBeNull();
    });

    it("two createNodeKeyStorage instances are independent", async () => {
      const storage1 = createNodeKeyStorage();
      const storage2 = createNodeKeyStorage();
      await storage1.setItem("key", "value1");
      expect(await storage2.getItem("key")).toBeNull();
      await storage2.setItem("key", "value2");
      expect(await storage1.getItem("key")).toBe("value1");
      expect(await storage2.getItem("key")).toBe("value2");
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

    it("getRandomValues works with different array sizes", () => {
      const rng = createNodeRandomValues();
      const arr0 = new Uint8Array(0);
      const out0 = rng.getRandomValues(arr0);
      expect(out0).toBe(arr0);

      const arr1 = new Uint8Array(1);
      const out1 = rng.getRandomValues(arr1);
      expect(out1).toBe(arr1);

      const arr256 = new Uint8Array(256);
      const out256 = rng.getRandomValues(arr256);
      expect(out256).toBe(arr256);
    });
  });
});
