/**
 * EnhancedRSAManager: full flow, validation, mnemonic recovery, remote transmission.
 * Uses Node adapters only (no Expo/RN).
 */

import {
  createNodeKeyStorage,
  createNodeRandomValues,
  createRSAManager,
  EnhancedRSAManager,
} from "../src/index";

function createManager(): EnhancedRSAManager {
  return new EnhancedRSAManager({
    keyStorage: createNodeKeyStorage(),
    randomValues: createNodeRandomValues(),
    platform: "node",
  });
}

async function getPrivateKey(manager: EnhancedRSAManager): Promise<string | null> {
  return (manager as any).getPrivateKey();
}

describe("EnhancedRSAManager", () => {
  describe("createRSAManager", () => {
    it("createRSAManager({ platform: 'node' }) returns a manager", () => {
      const manager = createRSAManager({ platform: "node" });
      expect(manager).toBeInstanceOf(EnhancedRSAManager);
      expect(manager.isKeyGenerated).toBe(false);
    });

    it("createRSAManager({ platform: 'expo', platformOS: 'ios' }) returns manager when expo deps available", () => {
      let hasExpoDeps = false;
      try {
        require.resolve("expo-secure-store");
        require.resolve("expo-crypto");
        hasExpoDeps = true;
      } catch {
        // Expo deps not installed; skip
      }
      if (!hasExpoDeps) {
        return;
      }
      const manager = createRSAManager({
        platform: "expo",
        platformOS: "ios",
      });
      expect(manager).toBeInstanceOf(EnhancedRSAManager);
    });

    it("createRSAManager({ platform: 'expo' }) uses platformOS when react-native unavailable", () => {
      let hasExpoDeps = false;
      try {
        require.resolve("expo-secure-store");
        require.resolve("expo-crypto");
        hasExpoDeps = true;
      } catch {
        // Expo deps not installed; skip
      }
      if (!hasExpoDeps) {
        return;
      }
      // Without platformOS, createRSAManager tries require('react-native'); in Node that throws and it uses "react-native" as default
      const manager = createRSAManager({ platform: "expo" });
      expect(manager).toBeInstanceOf(EnhancedRSAManager);
    });
  });

  describe("key generation and validation", () => {
    it("generateRSAKeypair returns true and sets isKeyGenerated", async () => {
      const manager = createManager();
      const ok = await manager.generateRSAKeypair(2048);
      expect(ok).toBe(true);
      expect(manager.isKeyGenerated).toBe(true);
      expect(manager.publicKeyString).toBeTruthy();
      expect(manager.mnemonicPhrase).toBeTruthy();
    }, 30000);

    it("generateRSAKeypair rejects key size below minimum", async () => {
      const manager = createManager();
      const ok = await manager.generateRSAKeypair(1024);
      expect(ok).toBe(false);
    });

    it("generateRSAKeypair(3072) succeeds", async () => {
      const manager = createManager();
      const ok = await manager.generateRSAKeypair(3072);
      expect(ok).toBe(true);
      expect(manager.isKeyGenerated).toBe(true);
    }, 45000);

    it("generateRSAKeypair(2047) returns false", async () => {
      const manager = createManager();
      const ok = await manager.generateRSAKeypair(2047);
      expect(ok).toBe(false);
    });
  });

  describe("local encrypt/decrypt round-trip", () => {
    it("encryptDataForLocalStorage and decryptDataFromLocalStorage round-trip", async () => {
      const manager = createManager();
      const ok = await manager.generateRSAKeypair(2048);
      expect(ok).toBe(true);

      const data = new TextEncoder().encode("hello world");
      const encrypted = await manager.encryptDataForLocalStorage(data);
      expect(encrypted).not.toBeNull();
      expect(encrypted!.length).toBeGreaterThan(0);

      const decrypted = await manager.decryptDataFromLocalStorage(encrypted!);
      expect(decrypted).not.toBeNull();
      expect(new TextDecoder().decode(decrypted!)).toBe("hello world");
    }, 30000);

    it("decryptDataFromLocalStorage returns null when no keys", async () => {
      const manager = createManager();
      const bogus = new Uint8Array(100);
      const decrypted = await manager.decryptDataFromLocalStorage(bogus);
      expect(decrypted).toBeNull();
    });

    it("decryptDataFromLocalStorage returns null for too-short payload", async () => {
      const manager = createManager();
      await manager.generateRSAKeypair(2048);
      const short = new Uint8Array(4);
      const decrypted = await manager.decryptDataFromLocalStorage(short);
      expect(decrypted).toBeNull();
    }, 30000);

    it("decryptDataFromLocalStorage returns null for keyLength 0", async () => {
      const manager = createManager();
      await manager.generateRSAKeypair(2048);
      const payload = new Uint8Array(12);
      new DataView(payload.buffer).setUint32(0, 0, false);
      const decrypted = await manager.decryptDataFromLocalStorage(payload);
      expect(decrypted).toBeNull();
    }, 30000);

    it("decryptDataFromLocalStorage returns null for keyLength > 10000", async () => {
      const manager = createManager();
      await manager.generateRSAKeypair(2048);
      const payload = new Uint8Array(10010);
      new DataView(payload.buffer).setUint32(0, 10001, false);
      const decrypted = await manager.decryptDataFromLocalStorage(payload);
      expect(decrypted).toBeNull();
    }, 30000);

    it("decryptDataFromLocalStorage returns null for truncated payload", async () => {
      const manager = createManager();
      await manager.generateRSAKeypair(2048);
      const payload = new Uint8Array(53);
      new DataView(payload.buffer).setUint32(0, 50, false);
      const decrypted = await manager.decryptDataFromLocalStorage(payload);
      expect(decrypted).toBeNull();
    }, 30000);

    it("encryptDataForLocalStorage with empty Uint8Array round-trip", async () => {
      const manager = createManager();
      await manager.generateRSAKeypair(2048);
      const data = new Uint8Array(0);
      const encrypted = await manager.encryptDataForLocalStorage(data);
      expect(encrypted).not.toBeNull();
      const decrypted = await manager.decryptDataFromLocalStorage(encrypted!);
      expect(decrypted).not.toBeNull();
      expect(decrypted!.length).toBe(0);
    }, 30000);
  });

  describe("RSA encrypt/decrypt", () => {
    it("encryptWithRSA + decryptWithRSA round-trip for short string (pure RSA path)", async () => {
      const manager = createManager();
      await manager.generateRSAKeypair(2048);
      const shortText = "Hello";
      const encrypted = await manager.encryptWithRSA(
        shortText,
        manager.publicKeyString,
      );
      expect(encrypted).not.toBeNull();
      expect(encrypted!).not.toMatch(/^HYBRID:/);

      const decrypted = await manager.decryptWithRSA(
        encrypted!,
        (await getPrivateKey(manager))!,
      );
      expect(decrypted).toBe(shortText);
    }, 30000);

    it("encryptWithRSA + decryptWithRSA for long string uses hybrid path", async () => {
      const manager = createManager();
      await manager.generateRSAKeypair(2048);
      const longText = "x".repeat(200);
      const encrypted = await manager.encryptWithRSA(
        longText,
        manager.publicKeyString,
      );
      expect(encrypted).not.toBeNull();
      expect(encrypted!).toMatch(/^HYBRID:/);

      const decrypted = await manager.decryptWithRSA(
        encrypted!,
        (await getPrivateKey(manager))!,
      );
      expect(decrypted).toBe(longText);
    }, 30000);

    it("decryptWithRSA with wrong private key returns null", async () => {
      const manager1 = createManager();
      const manager2 = createManager();
      await manager1.generateRSAKeypair(2048);
      await manager2.generateRSAKeypair(2048);

      const encrypted = await manager1.encryptWithRSA(
        "secret",
        manager1.publicKeyString,
      );
      expect(encrypted).not.toBeNull();

      const decrypted = await manager2.decryptWithRSA(
        encrypted!,
        (await getPrivateKey(manager2))!,
      );
      expect(decrypted).toBeNull();
    }, 45000);

    it("encryptWithRSA with invalid PEM returns null", async () => {
      const manager = createManager();
      await manager.generateRSAKeypair(2048);
      const encrypted = await manager.encryptWithRSA("data", "not-a-valid-pem");
      expect(encrypted).toBeNull();
    }, 30000);

    it("decryptWithRSA with malformed hybrid format returns null", async () => {
      const manager = createManager();
      await manager.generateRSAKeypair(2048);
      const decrypted = await manager.decryptWithRSA(
        "HYBRID:bad:data",
        (await getPrivateKey(manager))!,
      );
      expect(decrypted).toBeNull();
    }, 30000);
  });

  describe("hashing", () => {
    it("hashWithSHA512_256 is deterministic", () => {
      const manager = createManager();
      const h1 = manager.hashWithSHA512_256("test data");
      const h2 = manager.hashWithSHA512_256("test data");
      expect(h1).toBe(h2);
    });

    it("hashWithSalt yields different hashes for different salts", () => {
      const manager = createManager();
      const h1 = manager.hashWithSalt("data", "salt1");
      const h2 = manager.hashWithSalt("data", "salt2");
      expect(h1).not.toBe(h2);
    });
  });

  describe("storage lifecycle", () => {
    it("loadKeysFromSecureStorage returns false when no keys", async () => {
      const manager = createManager();
      const ok = await manager.loadKeysFromSecureStorage();
      expect(ok).toBe(false);
    });

    it("loadKeysFromSecureStorage returns true when keys present", async () => {
      const storage = createNodeKeyStorage();
      const manager1 = new EnhancedRSAManager({
        keyStorage: storage,
        randomValues: createNodeRandomValues(),
        platform: "node",
      });
      await manager1.generateRSAKeypair(2048);

      const manager2 = new EnhancedRSAManager({
        keyStorage: storage,
        randomValues: createNodeRandomValues(),
        platform: "node",
      });
      const ok = await manager2.loadKeysFromSecureStorage();
      expect(ok).toBe(true);
      expect(manager2.isKeyGenerated).toBe(true);
      expect(manager2.publicKeyString).toBe(manager1.publicKeyString);
    }, 30000);

    it("checkKeysInSecureStorage returns correct details", async () => {
      const manager = createManager();
      const before = await manager.checkKeysInSecureStorage();
      expect(before.exists).toBe(false);
      expect(before.details.privateKey).toBe(false);
      expect(before.details.publicKey).toBe(false);
      expect(before.details.mnemonic).toBe(false);

      await manager.generateRSAKeypair(2048);
      const after = await manager.checkKeysInSecureStorage();
      expect(after.exists).toBe(true);
      expect(after.details.privateKey).toBe(true);
      expect(after.details.publicKey).toBe(true);
      expect(after.details.mnemonic).toBe(true);
    }, 30000);

    it("saveKeysToSecureStorage returns false when !isKeyGenerated", async () => {
      const manager = createManager();
      const ok = await manager.saveKeysToSecureStorage();
      expect(ok).toBe(false);
    });

    it("saveKeysToSecureStorage returns true after generate", async () => {
      const manager = createManager();
      await manager.generateRSAKeypair(2048);
      const ok = await manager.saveKeysToSecureStorage();
      expect(ok).toBe(true);
    }, 30000);

    it("clearKeys removes keys and resets state", async () => {
      const manager = createManager();
      await manager.generateRSAKeypair(2048);
      expect(manager.isKeyGenerated).toBe(true);

      await manager.clearKeys();
      expect(manager.isKeyGenerated).toBe(false);
      expect(manager.publicKeyString).toBe("");
      expect(manager.mnemonicPhrase).toBe("");

      const check = await manager.checkKeysInSecureStorage();
      expect(check.exists).toBe(false);
    }, 30000);

    it("getStoredMnemonic returns mnemonic after generate, null before", async () => {
      const manager = createManager();
      expect(await manager.getStoredMnemonic()).toBeNull();

      await manager.generateRSAKeypair(2048);
      const mnemonic = await manager.getStoredMnemonic();
      expect(mnemonic).toBeTruthy();
      expect(mnemonic).toBe(manager.mnemonicPhrase);
    }, 30000);
  });

  describe("custom storage prefix", () => {
    it("storageKeyPrefix causes different storage keys; same prefix shares keys", async () => {
      const storage = createNodeKeyStorage();
      const prefix = "com.test.custom.prefix";
      const manager1 = new EnhancedRSAManager({
        keyStorage: storage,
        randomValues: createNodeRandomValues(),
        platform: "node",
        storageKeyPrefix: prefix,
      });
      await manager1.generateRSAKeypair(2048);

      const manager2 = new EnhancedRSAManager({
        keyStorage: storage,
        randomValues: createNodeRandomValues(),
        platform: "node",
        storageKeyPrefix: prefix,
      });
      const ok = await manager2.loadKeysFromSecureStorage();
      expect(ok).toBe(true);
      expect(manager2.publicKeyString).toBe(manager1.publicKeyString);

      const manager3 = new EnhancedRSAManager({
        keyStorage: storage,
        randomValues: createNodeRandomValues(),
        platform: "node",
        storageKeyPrefix: "com.other.prefix",
      });
      const ok3 = await manager3.loadKeysFromSecureStorage();
      expect(ok3).toBe(false);
    }, 30000);
  });

  describe("progress callback", () => {
    it("generateRSAKeypair invokes callback with expected message sequence", async () => {
      const manager = createManager();
      const messages: string[] = [];
      const cb = (msg: string) => messages.push(msg);
      await manager.generateRSAKeypair(2048, cb);

      expect(messages.length).toBeGreaterThan(0);
      expect(messages.some((m) => m.includes("mnemonic"))).toBe(true);
      expect(messages.some((m) => m.includes("prime"))).toBe(true);
      expect(messages.some((m) => m.includes("success"))).toBe(true);
    }, 30000);
  });

  describe("mnemonic recovery", () => {
    it("recoverKeysFromMnemonic restores keys; encrypt/decrypt works after", async () => {
      const manager1 = createManager();
      const ok = await manager1.generateRSAKeypair(2048);
      expect(ok).toBe(true);
      const mnemonic = manager1.mnemonicPhrase;
      expect(mnemonic).toBeTruthy();

      const manager2 = createManager();
      const recovered = await manager2.recoverKeysFromMnemonic(mnemonic);
      expect(recovered).toBe(true);

      const data = new TextEncoder().encode("recovered secret");
      const encrypted = await manager1.encryptDataForLocalStorage(data);
      expect(encrypted).not.toBeNull();
      const decrypted = await manager2.decryptDataFromLocalStorage(encrypted!);
      expect(decrypted).not.toBeNull();
      expect(new TextDecoder().decode(decrypted!)).toBe("recovered secret");
    }, 45000);

    it("recoverKeysFromMnemonic returns false for invalid mnemonic", async () => {
      const manager = createManager();
      const recovered =
        await manager.recoverKeysFromMnemonic("not valid words");
      expect(recovered).toBe(false);
    });

    it("recoverKeysFromMnemonic returns false for empty string", async () => {
      const manager = createManager();
      const recovered = await manager.recoverKeysFromMnemonic("   ");
      expect(recovered).toBe(false);
    });
  });

  describe("remote transmission", () => {
    it("prepareDataForRemoteTransmission and decryptRemoteTransmissionData round-trip", async () => {
      const manager = createManager();
      const ok = await manager.generateRSAKeypair(2048);
      expect(ok).toBe(true);

      const data = new TextEncoder().encode("remote payload");
      const payloadBytes = await manager.prepareDataForRemoteTransmission(data);
      expect(payloadBytes).not.toBeNull();

      const payload = JSON.parse(new TextDecoder().decode(payloadBytes!));
      expect(payload.encrypted_key).toBeDefined();
      expect(payload.encrypted_data).toBeDefined();

      const decrypted = await manager.decryptRemoteTransmissionData(
        payload.encrypted_key,
        payload.encrypted_data,
      );
      expect(decrypted).not.toBeNull();
      expect(new TextDecoder().decode(decrypted!)).toBe("remote payload");
    }, 30000);
  });
});
