/**
 * ForgeOptimization: applyForgeOptimization, isOptimizationApplied, performanceTest.
 * Runs in Node; react-native-modpow is not available, so optimization is skipped.
 */

import {
  applyForgeOptimization,
  isOptimizationApplied,
  performanceTest,
} from "../src/react-native";

describe("ForgeOptimization", () => {
  it("applyForgeOptimization does not throw", () => {
    expect(() => applyForgeOptimization()).not.toThrow();
  });

  it("isOptimizationApplied returns boolean", () => {
    const result = isOptimizationApplied();
    expect(typeof result).toBe("boolean");
  });

  it("performanceTest returns expected shape", async () => {
    const result = await performanceTest();
    expect(result).toHaveProperty("optimized");
    expect(result).toHaveProperty("keyGenerationTime");
    expect(result).toHaveProperty("keySize");
    expect(typeof result.optimized).toBe("boolean");
    expect(typeof result.keyGenerationTime).toBe("number");
    expect(result.keySize).toBe(2048);
  }, 60000);
});
