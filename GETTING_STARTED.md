# Getting Started with expo-crypto-lib

This document explains **where the library lives**, **how to install and build it**, and **how to use it** in an app (Expo/React Native or Node).

---

## Where the library is

- **Path**: This repository ([https://github.com/mryan-iadeptive/expo-crypto-lib](https://github.com/mryan-iadeptive/expo-crypto-lib)) is the library; the source lives at the repository root.
- **Contents**: Hybrid RSA + AES encryption (key generation, local and remote encrypt/decrypt), mnemonic generation and seed derivation, optional React Native performance optimization, and adapters for Expo and Node.

---

## Install and build

### From the repo (local / workspace)

1. Clone the repo and at its root install dependencies:

   ```bash
   git clone https://github.com/mryan-iadeptive/expo-crypto-lib.git
   cd expo-crypto-lib
   npm install
   ```

2. Build the TypeScript (output in `dist/`):

   ```bash
   npm run build
   ```

3. From another app (e.g. a sibling directory), reference the package by path:

   - **npm / package.json** (if your app is next to the clone, e.g. `my-app` and `expo-crypto-lib`):
     ```json
     "dependencies": {
       "expo-crypto-lib": "file:../expo-crypto-lib"
     }
     ```
   - Then run `npm install` in the app and import from `expo-crypto-lib`.

### After publishing

If the package is published to npm (or another registry), install it as usual:

```bash
npm install expo-crypto-lib
```

Then import from `expo-crypto-lib` (and optionally `expo-crypto-lib/react-native`).

---

## How to use it

The library is **environment-agnostic**: you must pass in a **key-storage adapter** and a **random-values adapter**. Bundled adapters:

- **Expo/React Native**: `createExpoKeyStorage`, `createExpoRandomValues` (require `expo-secure-store` and `expo-crypto` as peer dependencies).
- **Node (or tests)**: `createNodeKeyStorage`, `createNodeRandomValues` (in-memory storage; random from Node `crypto`).

### Minimal example (Node or test)

```ts
const {
  EnhancedRSAManager,
  createNodeKeyStorage,
  createNodeRandomValues,
} = require('expo-crypto-lib');

const storage = createNodeKeyStorage();
const random = createNodeRandomValues();

const manager = new EnhancedRSAManager({
  keyStorage: storage,
  randomValues: random,
  platform: 'node',
});

async function run() {
  const ok = await manager.generateRSAKeypair(2048);
  if (!ok) throw new Error('Key generation failed');

  const data = new TextEncoder().encode('secret message');
  const encrypted = await manager.encryptDataForLocalStorage(data);
  if (!encrypted) throw new Error('Encryption failed');

  const decrypted = await manager.decryptDataFromLocalStorage(encrypted);
  console.log(new TextDecoder().decode(decrypted)); // 'secret message'
}
run();
```

### Minimal example (Expo / React Native)

Install peer dependencies in your app: `expo-secure-store`, `expo-crypto`, `react-native`. Then:

```ts
import {
  EnhancedRSAManager,
  createExpoKeyStorage,
  createExpoRandomValues,
} from 'expo-crypto-lib';
import { Platform } from 'react-native';

const storage = createExpoKeyStorage();
const random = createExpoRandomValues();

const manager = new EnhancedRSAManager({
  keyStorage: storage,
  randomValues: random,
  platform: Platform.OS,
});

// Generate keys (e.g. on first run)
await manager.generateRSAKeypair(2048);

// Encrypt / decrypt for local storage
const encrypted = await manager.encryptDataForLocalStorage(fileBytes);
const decrypted = await manager.decryptDataFromLocalStorage(encrypted);
```

### Optional: React Native performance (Forge optimization)

On React Native, RSA key generation can be slow. You can patch `node-forge` with a native `modPow` implementation **before** any crypto use:

1. Install the optional peer dependency: `react-native-modpow`.
2. At app startup (e.g. in your root component or entry file):

   ```ts
   import { applyForgeOptimization } from 'expo-crypto-lib/react-native';

   applyForgeOptimization();
   ```

3. Then create and use `EnhancedRSAManager` as above. If `react-native-modpow` is not installed, `applyForgeOptimization()` is a no-op.

### Remote transmission

- **Encrypt** (prepare payload to send):  
  `encryptedPayloadBytes = await manager.prepareDataForRemoteTransmission(data)`
- **Decrypt** (on receiver):  
  Parse the payload JSON, then  
  `decrypted = await manager.decryptRemoteTransmissionData(encrypted_key, encrypted_data)`

### Mnemonic and key recovery

- Generate mnemonic and keys: `await manager.generateRSAKeypair(2048)` (mnemonic is stored with keys).
- Get mnemonic after generation: `await manager.getStoredMnemonic()` (or use `manager.mnemonicPhrase` if you just generated).
- Recover keys from mnemonic: `await manager.recoverKeysFromMnemonic(mnemonic)` (then keys are in storage again).

### Building a “user-scoped” manager on top

The library does **not** include user IDs or backend APIs. To get behavior like “one key per user” and server key registration:

1. Implement your own **key-storage adapter** that uses the same `getItem`/`setItem`/`removeItem` interface but with keys prefixed by `userId` (e.g. `nexus_user_keys_${userId}_private`).
2. Create one `EnhancedRSAManager` per user (or one instance and swap storage), using that adapter and your `randomValues` (and optional `platform`).
3. Keep **server key registration / vault API** in your app: after generating or recovering keys, call your backend to register the public key and get a `key_id`; store that in your app state or storage. The library stays agnostic of HTTP and backend.

---

## API summary

- **EnhancedRSAManager** (constructor: `keyStorage`, `randomValues`, optional `platform`)
  - Key lifecycle: `generateRSAKeypair`, `recoverKeysFromMnemonic`, `loadKeysFromSecureStorage`, `checkKeysInSecureStorage`, `saveKeysToSecureStorage`, `clearKeys`
  - Local: `encryptDataForLocalStorage`, `decryptDataFromLocalStorage`
  - Remote: `prepareDataForRemoteTransmission`, `decryptRemoteTransmissionData`
  - Raw RSA (string): `encryptWithRSA`, `decryptWithRSA`
  - Helpers: `getStoredMnemonic`, `getPrivateKey` / `getPublicKey` (protected), `hashWithSHA512_256`, `uint8ArrayToString`, etc.
- **MnemonicManager** (static): `generateMnemonic(randomAdapter?)`, `mnemonicToSeed(mnemonic, passphrase?)`, `validateMnemonic(mnemonic)`
- **Types**: `ProgressCallback`, `TransmissionPayload`, `ValidationResult`, `CryptoKeyPair`, `EnhancedRSAManagerOptions`
- **Adapters**: `IKeyStorage`, `IRandomValues`, `createExpoKeyStorage`, `createExpoRandomValues`, `createNodeKeyStorage`, `createNodeRandomValues`
- **React Native entry**: `applyForgeOptimization`, `isOptimizationApplied`, `performanceTest` from `expo-crypto-lib/react-native`

---

## Dependencies

- **Required**: `node-forge`, `base64-arraybuffer`.
- **Optional (for Expo adapter)**: `expo-secure-store`, `expo-crypto`, `react-native` (peer).
- **Optional (for Forge optimization)**: `react-native-modpow` (only when using `expo-crypto-lib/react-native`).
