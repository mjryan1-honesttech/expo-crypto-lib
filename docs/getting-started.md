# Getting Started with expo-crypto-lib

This document explains **where the library lives**, **how to install and build it**, and **how to use it** in an app (Expo/React Native or Node).

---

## Requirements

- **Node:** 22 or newer (for building, testing, and Node runtime usage). Use `nvm use` or `fnm use` with the included `.nvmrc`.
- **Expo / React Native:** Expo SDK 56 or 57 (React Native 0.85+) with the **Hermes** engine (X25519 requires `BigInt`). When using the Expo adapters (`createExpoKeyStorage`, `createExpoRandomValues`), your app must have `expo`, `expo-crypto`, `expo-secure-store`, and `react-native` installed (typically already present in an Expo project).
- **Version policy:** only the latest major of Expo and npm, or the one before it (N and N-1), is supported. `npm run check:versions` enforces this and runs in CI. On Expo SDK 55 or older, use `expo-crypto-lib@2`.

---

## Where the library is

- **Path**: This repository ([https://github.com/mjryan1-honesttech/expo-crypto-lib](https://github.com/mjryan1-honesttech/expo-crypto-lib)) is the library; the source lives at the repository root.
- **Contents**: X25519 + HPKE encryption (key derivation, at-rest and public-key encrypt/decrypt), BIP39 mnemonic generation and seed derivation, and adapters for Expo and Node.

---

## Install and build

### From the repo (local / workspace)

1. Clone the repo and at its root install dependencies. **Node 22+ and npm 11 or 12 are required** (use `nvm use` or `fnm use` with the included `.nvmrc`; npm refuses to install on an unsupported version, via `devEngines`):

   ```bash
   git clone https://github.com/mjryan1-honesttech/expo-crypto-lib.git
   cd expo-crypto-lib
   nvm use    # or: fnm use — uses .nvmrc to select Node 22+
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

Then import from `expo-crypto-lib`.

---

## How to use it

The library is **environment-agnostic**: you pass in a **key-storage adapter** and a **random-values adapter**. Bundled adapters:

- **Expo/React Native**: `createExpoKeyStorage`, `createExpoRandomValues` (require `expo-secure-store` and `expo-crypto` as peer dependencies).
- **Node (or tests)**: `createNodeKeyStorage`, `createNodeRandomValues` (in-memory storage; random from Node `crypto`).

All randomness flows through the adapter, so no global `crypto` or WebCrypto polyfill is needed in React Native.

### Minimal example (Node or test)

```ts
const {
  CryptoManager,
  createNodeKeyStorage,
  createNodeRandomValues,
} = require('expo-crypto-lib');

const manager = new CryptoManager({
  keyStorage: createNodeKeyStorage(),
  randomValues: createNodeRandomValues(),
});

async function run() {
  const mnemonic = await manager.generate();
  console.log('save this phrase:', mnemonic); // returned once, never stored

  const data = new TextEncoder().encode('secret message');
  const encrypted = manager.encryptLocal(data);
  console.log(new TextDecoder().decode(manager.decryptLocal(encrypted)));
}
run();
```

### Minimal example (Expo / React Native)

Install peer dependencies in your app: `expo-secure-store`, `expo-crypto`. Then:

```ts
import { createCryptoManager } from 'expo-crypto-lib';

const manager = createCryptoManager({ platform: 'expo' });

// First run: create an identity and show the phrase once.
if (!(await manager.load())) {
  const mnemonic = await manager.generate();
  displayBackupPhrase(mnemonic);
}

const encrypted = manager.encryptLocal(fileBytes);
const decrypted = manager.decryptLocal(encrypted);
```

### Gating keys behind biometrics

Options are passed straight through to `expo-secure-store`:

```ts
import * as SecureStore from 'expo-secure-store';

const manager = createCryptoManager({
  platform: 'expo',
  storageOptions: {
    requireAuthentication: true,
    authenticationPrompt: 'Unlock your encryption keys',
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  },
});
```

`accessGroup` shares entries between **your own** iOS apps (needs a matching keychain-sharing entitlement). Android has no cross-app equivalent.

Use `loadPublicKey()` to read the public key without touching the seed — handy when the seed is behind a biometric prompt and you only need to publish the public key.

### Encrypting to another party

```ts
const sealed = manager.encryptFor(recipientPublicKey, bytes); // 32 raw bytes
const opened = recipientManager.decrypt(sealed);
```

The envelope is HPKE (RFC 9180) base mode with suite `DHKEM(X25519, HKDF-SHA256) / HKDF-SHA256 / ChaCha20Poly1305`, so a backend can decrypt it with any standard HPKE library.

### Mnemonic and key recovery

- Generate an identity: `const mnemonic = await manager.generate()` — the phrase is returned once and **never written to storage**.
- Recover on another device: `await manager.recover(mnemonic)` — throws `CryptoError` with code `INVALID_MNEMONIC` if the BIP39 checksum fails.
- Load an existing identity: `await manager.load()` — returns `false` when nothing is stored.
- A passphrase is supported as a second factor: `generate(passphrase)` / `recover(mnemonic, passphrase)`. The same phrase with a different passphrase is a different identity.

### Building a "user-scoped" manager on top

The library does **not** include user IDs or backend APIs. For "one key per user" plus server key registration:

1. Pass `storageKeyPrefix: \`user_${userId}\`` , or implement a **key-storage adapter** using the same `getItem`/`setItem`/`removeItem` interface with user-prefixed keys.
2. Create one `CryptoManager` per user (or one instance and swap storage).
3. Keep **server key registration** in your app: after `generate()` or `recover()`, send `manager.publicKeyBase64` to your backend and store whatever key id it returns. The library stays agnostic of HTTP and backends.

---

## API summary

- **createCryptoManager(options)** — Convenience factory. `createCryptoManager({ platform: 'node' })` or `createCryptoManager({ platform: 'expo', storageOptions?, storageKeyPrefix? })`.
- **CryptoManager** (constructor: `keyStorage`, `randomValues`, optional `storageKeyPrefix`)
  - Identity lifecycle: `generate(passphrase?)`, `recover(mnemonic, passphrase?)`, `load()`, `loadPublicKey()`, `hasKeys()`, `clear()`
  - At rest: `encryptLocal(bytes)`, `decryptLocal(envelope)`
  - To a public key: `encryptFor(recipientPublicKey, bytes)`, `decrypt(envelope)`
  - Accessors: `publicKey` (32 bytes), `publicKeyBase64`, `isReady`
- **Key derivation** (from `expo-crypto-lib`): `generateMnemonicPhrase(random)`, `validateMnemonicPhrase(mnemonic)`, `mnemonicToSeed(mnemonic, passphrase?)`, `deriveIdentityKeyPair(seed)`, `deriveLocalKey(seed)`
- **Errors**: `CryptoError` with `code` — `NO_KEYS`, `AUTH_FAILED`, `BAD_FORMAT`, `UNSUPPORTED_VERSION`, `INVALID_MNEMONIC`, `STORAGE_FAILED`, `VALUE_TOO_LARGE`
- **Envelope**: `VERSION`, `MODE_LOCAL`, `MODE_HPKE`, `readMode(envelope)`
- **Types**: `CryptoManagerOptions`, `CreateCryptoManagerOptions`, `ExpoKeyStorageOptions`, `IdentityKeyPair`, `CryptoErrorCode`
- **Adapters**: `IKeyStorage`, `IRandomValues`, `createExpoKeyStorage`, `createExpoRandomValues`, `createNodeKeyStorage`, `createNodeRandomValues`

---

## Envelope format

Every ciphertext is self-describing, and its header is authenticated as AEAD associated data:

```
byte 0   version (0x02)
byte 1   mode: 0x00 local, 0x01 hpke
mode 0x00: nonce(24) || ciphertext+tag     XChaCha20-Poly1305 under the seed-derived local key
mode 0x01: enc(32)   || ciphertext+tag     HPKE base mode to a public key
```

Overhead is 42 bytes for local mode and 50 bytes for HPKE mode.

---

## Dependencies

- **Required**: `@noble/ciphers`, `@noble/curves`, `@noble/hashes`, `@scure/bip39`, `@scure/base` — all pure JavaScript, so there is no native module and no prebuild.
- **Optional (for the Expo adapter)**: `expo-secure-store`, `expo-crypto`, `react-native` (peer). Install with `npx expo install expo-secure-store expo-crypto` if missing.
