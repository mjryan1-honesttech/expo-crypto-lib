/**
 * CryptoManager lifecycle: key storage, recovery, and the guarantee that the
 * recovery phrase is never written to storage.
 */

import {
  CryptoError,
  CryptoManager,
  createCryptoManager,
  createNodeKeyStorage,
  createNodeRandomValues,
  validateMnemonicPhrase,
} from "../src/index";
import type { IKeyStorage } from "../src/index";

const random = createNodeRandomValues();

function newManager(storage: IKeyStorage = createNodeKeyStorage()) {
  return new CryptoManager({ keyStorage: storage, randomValues: random });
}

/** Storage that records every key written, so tests can assert what was stored. */
function recordingStorage(): IKeyStorage & { written: Map<string, string> } {
  const written = new Map<string, string>();
  return {
    written,
    async getItem(key) {
      return written.get(key) ?? null;
    },
    async setItem(key, value) {
      written.set(key, value);
    },
    async removeItem(key) {
      written.delete(key);
    },
  };
}

function expectCode(run: () => unknown, code: string): void {
  expect(run).toThrow(CryptoError);
  try {
    run();
  } catch (error) {
    expect((error as CryptoError).code).toBe(code);
  }
}

async function expectAsyncCode(
  run: () => Promise<unknown>,
  code: string,
): Promise<void> {
  await expect(run()).rejects.toThrow(CryptoError);
  try {
    await run();
  } catch (error) {
    expect((error as CryptoError).code).toBe(code);
  }
}

const text = new TextEncoder();

describe("CryptoManager", () => {
  describe("generate", () => {
    it("returns a valid 24-word phrase and becomes ready", async () => {
      const manager = newManager();
      const mnemonic = await manager.generate();
      expect(mnemonic.split(" ").length).toBe(24);
      expect(validateMnemonicPhrase(mnemonic)).toBe(true);
      expect(manager.isReady).toBe(true);
      expect(manager.publicKey.length).toBe(32);
    });

    // The whole point of a recovery phrase is that stealing the device is not
    // enough to steal the phrase.
    it("never writes the phrase to storage", async () => {
      const storage = recordingStorage();
      const mnemonic = await newManager(storage).generate();

      expect([...storage.written.keys()].sort()).toEqual([
        "expo-crypto-lib.publicKey",
        "expo-crypto-lib.seed",
      ]);
      for (const value of storage.written.values()) {
        expect(value).not.toContain(mnemonic);
        for (const word of mnemonic.split(" ")) {
          expect(value.toLowerCase()).not.toContain(` ${word} `);
        }
      }
    });

    it("stores a seed small enough for the iOS keychain limit", async () => {
      const storage = recordingStorage();
      await newManager(storage).generate();
      for (const value of storage.written.values()) {
        expect(new TextEncoder().encode(value).length).toBeLessThan(2048);
      }
    });

    it("produces a different identity each time", async () => {
      const a = await newManager().generate();
      const b = await newManager().generate();
      expect(a).not.toBe(b);
    });
  });

  describe("recover", () => {
    it("restores the same identity from the phrase", async () => {
      const first = newManager();
      const mnemonic = await first.generate();
      const expected = first.publicKeyBase64;

      const second = newManager();
      await second.recover(mnemonic);
      expect(second.publicKeyBase64).toBe(expected);
    });

    it("recovers data encrypted before the device was lost", async () => {
      const storage = createNodeKeyStorage();
      const first = newManager(storage);
      const mnemonic = await first.generate();
      const sealed = first.encryptLocal(text.encode("medical record"));

      const replacement = newManager(createNodeKeyStorage());
      await replacement.recover(mnemonic);
      expect(new TextDecoder().decode(replacement.decryptLocal(sealed))).toBe(
        "medical record",
      );
    });

    it("a passphrase yields a different identity", async () => {
      const mnemonic = await newManager().generate();
      const plain = newManager();
      const withPassphrase = newManager();
      await plain.recover(mnemonic);
      await withPassphrase.recover(mnemonic, "extra");
      expect(plain.publicKeyBase64).not.toBe(withPassphrase.publicKeyBase64);
    });

    it("throws INVALID_MNEMONIC for a bad phrase", async () => {
      const manager = newManager();
      await expectAsyncCode(
        () => manager.recover("not a valid phrase at all"),
        "INVALID_MNEMONIC",
      );
    });

    it("throws INVALID_MNEMONIC for a single-word typo", async () => {
      const mnemonic = (await newManager().generate()).split(" ");
      mnemonic[0] = mnemonic[0] === "zoo" ? "zone" : "zoo";
      const manager = newManager();
      await expectAsyncCode(
        () => manager.recover(mnemonic.join(" ")),
        "INVALID_MNEMONIC",
      );
    });
  });

  describe("load / hasKeys / clear", () => {
    it("load returns false when nothing is stored", async () => {
      expect(await newManager().load()).toBe(false);
    });

    it("load restores keys written by a previous session", async () => {
      const storage = createNodeKeyStorage();
      const first = newManager(storage);
      await first.generate();
      const expected = first.publicKeyBase64;

      const second = newManager(storage);
      expect(await second.load()).toBe(true);
      expect(second.publicKeyBase64).toBe(expected);
    });

    it("hasKeys reflects storage state", async () => {
      const storage = createNodeKeyStorage();
      const manager = newManager(storage);
      expect(await manager.hasKeys()).toBe(false);
      await manager.generate();
      expect(await manager.hasKeys()).toBe(true);
      await manager.clear();
      expect(await manager.hasKeys()).toBe(false);
    });

    it("loadPublicKey works without loading the seed", async () => {
      const storage = createNodeKeyStorage();
      const first = newManager(storage);
      await first.generate();

      const second = newManager(storage);
      const publicKey = await second.loadPublicKey();
      expect(publicKey).toEqual(first.publicKey);
      expect(second.isReady).toBe(false);
    });

    it("clear removes keys and resets state", async () => {
      const manager = newManager();
      await manager.generate();
      await manager.clear();
      expect(manager.isReady).toBe(false);
      expectCode(() => manager.publicKey, "NO_KEYS");
    });

    it("throws BAD_FORMAT for a corrupted stored seed", async () => {
      const storage = createNodeKeyStorage();
      await storage.setItem("expo-crypto-lib.seed", "!!!not-base64!!!");
      const manager = newManager(storage);
      await expectAsyncCode(() => manager.load(), "BAD_FORMAT");
    });

    it("throws BAD_FORMAT for a stored seed of the wrong length", async () => {
      const storage = createNodeKeyStorage();
      await storage.setItem("expo-crypto-lib.seed", "AAAA");
      const manager = newManager(storage);
      await expectAsyncCode(() => manager.load(), "BAD_FORMAT");
    });
  });

  describe("without keys", () => {
    it("every crypto operation throws NO_KEYS", () => {
      const manager = newManager();
      expectCode(() => manager.encryptLocal(text.encode("x")), "NO_KEYS");
      expectCode(() => manager.decryptLocal(new Uint8Array(64)), "NO_KEYS");
      expectCode(() => manager.decrypt(new Uint8Array(64)), "NO_KEYS");
      expectCode(() => manager.publicKey, "NO_KEYS");
      expectCode(() => manager.publicKeyBase64, "NO_KEYS");
    });
  });

  describe("encryptFor / decrypt", () => {
    it("one party encrypts to another party's public key", async () => {
      const sender = newManager();
      const recipient = newManager();
      await sender.generate();
      await recipient.generate();

      const sealed = sender.encryptFor(
        recipient.publicKey,
        text.encode("for your eyes only"),
      );
      expect(new TextDecoder().decode(recipient.decrypt(sealed))).toBe(
        "for your eyes only",
      );
    });

    it("the sender cannot decrypt its own outgoing message", async () => {
      const sender = newManager();
      const recipient = newManager();
      await sender.generate();
      await recipient.generate();

      const sealed = sender.encryptFor(recipient.publicKey, text.encode("hi"));
      expectCode(() => sender.decrypt(sealed), "AUTH_FAILED");
    });

    it("encrypting to our own public key round-trips", async () => {
      const manager = newManager();
      await manager.generate();
      const sealed = manager.encryptFor(manager.publicKey, text.encode("self"));
      expect(new TextDecoder().decode(manager.decrypt(sealed))).toBe("self");
    });
  });

  describe("storageKeyPrefix", () => {
    it("separates identities that share one storage backend", async () => {
      const storage = createNodeKeyStorage();
      const tenantA = new CryptoManager({
        keyStorage: storage,
        randomValues: random,
        storageKeyPrefix: "tenant-a",
      });
      const tenantB = new CryptoManager({
        keyStorage: storage,
        randomValues: random,
        storageKeyPrefix: "tenant-b",
      });
      await tenantA.generate();
      await tenantB.generate();
      expect(tenantA.publicKeyBase64).not.toBe(tenantB.publicKeyBase64);

      // Clearing one tenant must not disturb the other.
      await tenantA.clear();
      expect(await tenantB.hasKeys()).toBe(true);
    });
  });

  describe("createCryptoManager", () => {
    it("builds a working node manager", async () => {
      const manager = createCryptoManager({ platform: "node" });
      const mnemonic = await manager.generate();
      expect(validateMnemonicPhrase(mnemonic)).toBe(true);
      const sealed = manager.encryptLocal(text.encode("round trip"));
      expect(new TextDecoder().decode(manager.decryptLocal(sealed))).toBe(
        "round trip",
      );
    });
  });
});
