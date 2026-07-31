# Use Cases

Concrete examples for common scenarios.

---

## 1. Encrypting sensitive app data for local storage

Store credentials, PII, or other sensitive data in AsyncStorage (or similar) without leaving it in plaintext. The seed and public key live in `expo-secure-store` — Keychain on iOS, Keystore-backed storage on Android — and can be gated behind biometrics with `storageOptions`.

```ts
import { createCryptoManager } from 'expo-crypto-lib';

const manager = createCryptoManager({ platform: 'expo' });
if (!(await manager.load())) {
  const mnemonic = await manager.generate();
  displayBackupPhrase(mnemonic); // shown once, never stored
}

const credentials = new TextEncoder().encode(JSON.stringify({ username, token }));
const encrypted = manager.encryptLocal(credentials);
await AsyncStorage.setItem('user_credentials', JSON.stringify(Array.from(encrypted)));

// Later, to decrypt:
const raw = await AsyncStorage.getItem('user_credentials');
const decrypted = manager.decryptLocal(new Uint8Array(JSON.parse(raw ?? '[]')));
const { username, token } = JSON.parse(new TextDecoder().decode(decrypted));
```

---

## 2. Encrypted file backup or transit

Encrypt on one device, send the payload to your server or another device, decrypt later. Because the envelope is HPKE (RFC 9180), a backend can decrypt it with any standard HPKE library.

**Encrypt and send:**

```ts
const manager = createCryptoManager({ platform: 'expo' });
await manager.load();

const fileBytes = await readFileAsBytes(documentUri);
const sealed = manager.encryptFor(manager.publicKey, fileBytes);
// Upload `sealed` (a single Uint8Array) to your backend or send to your other device
```

**Decrypt (same user, e.g. after recovery on a new device):**

```ts
const manager = createCryptoManager({ platform: 'expo' });
await manager.recover(userMnemonic);

const decrypted = manager.decrypt(sealed);
```

To let a **peer** decrypt instead, encrypt to their public key: `manager.encryptFor(theirPublicKey, bytes)`. Publish yours with `manager.publicKeyBase64`.

---

## 3. Account recovery after device loss

Let users back up a 24-word BIP39 phrase during onboarding. If they lose their device, they can recover their keys on a new one and regain access.

**On first setup:**

```ts
const mnemonic = await manager.generate();
// This is the only time the phrase exists outside the user's own records.
displayBackupPhrase(mnemonic);
```

**On new device:**

```ts
try {
  await manager.recover(userEnteredRecoveryPhrase);
  // Keys are restored; user can decrypt their data
} catch (error) {
  if (error.code === 'INVALID_MNEMONIC') {
    showError('That phrase is not valid — check for typos.');
  }
}
```

The BIP39 checksum catches typos and reordered words, so a wrong phrase reports an error instead of silently deriving keys that decrypt nothing.

---

## 4. Secure offline-first cache

Cache health data, financial records, or other sensitive info locally so the app works offline. Everything is encrypted at rest.

```ts
const manager = createCryptoManager({ platform: 'expo' });
if (!(await manager.load())) {
  displayBackupPhrase(await manager.generate());
}

const records = new TextEncoder().encode(JSON.stringify(healthRecords));
const encrypted = manager.encryptLocal(records);
await AsyncStorage.setItem('offline_cache', JSON.stringify(Array.from(encrypted)));

// On load:
const raw = await AsyncStorage.getItem('offline_cache');
const decrypted = manager.decryptLocal(new Uint8Array(JSON.parse(raw ?? '[]')));
const records = JSON.parse(new TextDecoder().decode(decrypted));
```

If the stored bytes were modified, `decryptLocal` throws `CryptoError` with code `AUTH_FAILED` rather than returning corrupt data.

---

## 5. Multi-tenant / user-scoped keys

Different keys per user when the same app is used by multiple accounts. `storageKeyPrefix` is usually enough:

```ts
import { CryptoManager, createExpoKeyStorage, createExpoRandomValues } from 'expo-crypto-lib';

const manager = new CryptoManager({
  keyStorage: createExpoKeyStorage(),
  randomValues: createExpoRandomValues(),
  storageKeyPrefix: `user_${currentUserId}`,
});
```

For full control over where keys land, supply your own storage adapter:

```ts
import * as SecureStore from 'expo-secure-store';

function createUserScopedStorage(userId: string) {
  const prefix = `user_${userId}_`;
  return {
    async getItem(key: string) {
      return SecureStore.getItemAsync(prefix + key);
    },
    async setItem(key: string, value: string) {
      await SecureStore.setItemAsync(prefix + key, value);
    },
    async removeItem(key: string) {
      await SecureStore.deleteItemAsync(prefix + key);
    },
  };
}

const manager = new CryptoManager({
  keyStorage: createUserScopedStorage(currentUserId),
  randomValues: createExpoRandomValues(),
});
```

---

## 6. Testing crypto logic in Node

Run encryption and recovery flows in Node without an Expo app. Useful for tests or server-side use.

```ts
const { createCryptoManager } = require('expo-crypto-lib');

const manager = createCryptoManager({ platform: 'node' });
await manager.generate();

const data = new TextEncoder().encode('test payload');
const encrypted = manager.encryptLocal(data);
assert.deepEqual(manager.decryptLocal(encrypted), data);
```

Note that `createNodeKeyStorage()` is in-memory: keys do not survive a process restart. Supply your own adapter to persist them server-side.
