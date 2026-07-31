/**
 * Expo adapter: security options must actually reach expo-secure-store, and
 * oversized values must be rejected before the platform silently refuses them.
 *
 * expo-secure-store is a peer dependency that does not exist in Node, so it is
 * mocked here.
 */

import { createExpoKeyStorage } from "../src/adapters/expoAdapter";
import { CryptoError } from "../src/errors";

const setItemAsync = jest.fn(async () => undefined);
const getItemAsync = jest.fn(async () => null);
const deleteItemAsync = jest.fn(async () => undefined);

jest.mock(
  "expo-secure-store",
  () => ({
    setItemAsync,
    getItemAsync,
    deleteItemAsync,
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: "whenUnlockedThisDeviceOnly",
  }),
  { virtual: true },
);

describe("createExpoKeyStorage", () => {
  beforeEach(() => {
    setItemAsync.mockClear();
    getItemAsync.mockClear();
    deleteItemAsync.mockClear();
  });

  it("forwards security options to every SecureStore call", async () => {
    const options = {
      requireAuthentication: true,
      authenticationPrompt: "Unlock your keys",
      keychainAccessible: "whenUnlockedThisDeviceOnly",
      keychainService: "com.example.app",
      accessGroup: "TEAMID.com.example.shared",
    };
    const storage = createExpoKeyStorage(options);

    await storage.setItem("k", "v");
    await storage.getItem("k");
    await storage.removeItem("k");

    expect(setItemAsync).toHaveBeenCalledWith("k", "v", options);
    expect(getItemAsync).toHaveBeenCalledWith("k", options);
    expect(deleteItemAsync).toHaveBeenCalledWith("k", options);
  });

  it("works with no options passed", async () => {
    await createExpoKeyStorage().setItem("k", "v");
    expect(setItemAsync).toHaveBeenCalledWith("k", "v", {});
  });

  it("throws VALUE_TOO_LARGE above the iOS keychain limit", async () => {
    const storage = createExpoKeyStorage();
    const tooBig = "a".repeat(2049);

    await expect(storage.setItem("k", tooBig)).rejects.toThrow(CryptoError);
    await expect(storage.setItem("k", tooBig)).rejects.toMatchObject({
      code: "VALUE_TOO_LARGE",
    });
    expect(setItemAsync).not.toHaveBeenCalled();
  });

  it("measures the limit in UTF-8 bytes, not characters", async () => {
    const storage = createExpoKeyStorage();
    // 1024 three-byte characters is 3072 bytes.
    await expect(storage.setItem("k", "☃".repeat(1024))).rejects.toMatchObject({
      code: "VALUE_TOO_LARGE",
    });
  });

  it("accepts a value at the limit", async () => {
    await createExpoKeyStorage().setItem("k", "a".repeat(2048));
    expect(setItemAsync).toHaveBeenCalled();
  });
});
