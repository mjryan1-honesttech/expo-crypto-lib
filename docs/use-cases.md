# Use Cases

Concrete examples for common scenarios.

---

## 1. Encrypting sensitive app data for local storage

Store credentials, PII, or other sensitive data in AsyncStorage (or similar) without leaving it in plaintext. Keys stay in hardware-backed secure storage on device.

```ts
import { createRSAManager } from 'expo-crypto-lib';
import { Platform } from 'react-native';

const manager = createRSAManager({ platform: 'expo', platformOS: Platform.OS });
await manager.generateRSAKeypair(2048);

const credentials = new TextEncoder().encode(JSON.stringify({ username, token }));
const encrypted = await manager.encryptDataForLocalStorage(credentials);
await AsyncStorage.setItem('user_credentials', JSON.stringify(Array.from(encrypted ?? [])));

// Later, to decrypt:
const raw = await AsyncStorage.getItem('user_credentials');
const decrypted = await manager.decryptDataFromLocalStorage(new Uint8Array(JSON.parse(raw ?? '[]')));
const { username, token } = JSON.parse(new TextDecoder().decode(decrypted));
```

---

## 2. Encrypted file backup or transit

Encrypt on one device, send the payload to your server or another device, decrypt later. Uses your own keypair—encrypt with your public key, decrypt with your private key (e.g. after recovering from mnemonic on the other device).

**Encrypt and send:**

```ts
const manager = createRSAManager({ platform: 'expo', platformOS: Platform.OS });
await manager.generateRSAKeypair(2048);

const fileBytes = await readFileAsBytes(documentUri);
const payloadBytes = await manager.prepareDataForRemoteTransmission(fileBytes);
const payload = JSON.parse(new TextDecoder().decode(payloadBytes ?? []));
// Upload payload (has encrypted_key, encrypted_data) to your backend or send to your other device
```

**Decrypt (same user, e.g. after mnemonic recovery):**

```ts
const manager = createRSAManager({ platform: 'expo', platformOS: Platform.OS });
await manager.recoverKeysFromMnemonic(userMnemonic);

const decrypted = await manager.decryptRemoteTransmissionData(
  payload.encrypted_key,
  payload.encrypted_data
);
```

---

## 3. Account recovery after device loss

Let users back up a 24-word mnemonic during onboarding. If they lose their device, they can recover their keys on a new device and regain access.

**On first setup:**

```ts
await manager.generateRSAKeypair(2048);
const mnemonic = await manager.getStoredMnemonic();
// Show mnemonic to user, instruct them to store it safely
displayBackupPhrase(mnemonic);
```

**On new device:**

```ts
const mnemonic = userEnteredRecoveryPhrase;
const ok = await manager.recoverKeysFromMnemonic(mnemonic);
if (ok) {
  // Keys are restored; user can decrypt their data
}
```

---

## 4. Secure offline-first cache

Cache health data, financial records, or other sensitive info locally so the app works offline. Everything is encrypted at rest.

```ts
const manager = createRSAManager({ platform: 'expo', platformOS: Platform.OS });
if (!(await manager.checkKeysInSecureStorage())) {
  await manager.generateRSAKeypair(2048);
}

const records = new TextEncoder().encode(JSON.stringify(healthRecords));
const encrypted = await manager.encryptDataForLocalStorage(records);
await AsyncStorage.setItem('offline_cache', JSON.stringify(Array.from(encrypted ?? [])));

// On load:
const raw = await AsyncStorage.getItem('offline_cache');
const decrypted = await manager.decryptDataFromLocalStorage(new Uint8Array(JSON.parse(raw ?? '[]')));
const records = JSON.parse(new TextDecoder().decode(decrypted));
```

---

## 5. Multi-tenant / user-scoped keys

Different keys per user when the same app is used by multiple accounts. Use `storageKeyPrefix` or a custom key-storage adapter with user-prefixed keys.

```ts
import {
  EnhancedRSAManager,
  createExpoKeyStorage,
  createExpoRandomValues,
} from 'expo-crypto-lib';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

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

const storage = createUserScopedStorage(currentUserId);
const manager = new EnhancedRSAManager({
  keyStorage: storage,
  randomValues: createExpoRandomValues(),
  platform: Platform.OS,
});
```

---

## 6. Testing crypto logic in Node

Run encryption/decryption and mnemonic flows in Node without an Expo app. Useful for tests or server-side use.

```ts
const { createRSAManager } = require('expo-crypto-lib');

const manager = createRSAManager({ platform: 'node' });
await manager.generateRSAKeypair(2048);

const data = new TextEncoder().encode('test payload');
const encrypted = await manager.encryptDataForLocalStorage(data);
const decrypted = await manager.decryptDataFromLocalStorage(encrypted);
assert.deepEqual(decrypted, data);
```
