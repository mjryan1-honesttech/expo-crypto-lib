/**
 * EnhancedRSAManager: full flow, validation, mnemonic recovery, remote transmission.
 * Uses Node adapters only (no Expo/RN).
 */

import {
  createNodeKeyStorage,
  createNodeRandomValues,
  createRSAManager,
  EnhancedRSAManager,
} from "../index";

function createManager(): EnhancedRSAManager {
  return new EnhancedRSAManager({
    keyStorage: createNodeKeyStorage(),
    randomValues: createNodeRandomValues(),
    platform: "node",
  });
}

describe("EnhancedRSAManager", () => {
  describe("createRSAManager", () => {
    it("createRSAManager({ platform: 'node' }) returns a manager", () => {
      const manager = createRSAManager({ platform: "node" });
      expect(manager).toBeInstanceOf(EnhancedRSAManager);
      expect(manager.isKeyGenerated).toBe(false);
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
