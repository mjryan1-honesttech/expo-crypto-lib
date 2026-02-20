# expo-crypto-lib

[![CI](https://github.com/mryan-iadeptive/expo-crypto-lib/actions/workflows/ci.yml/badge.svg)](https://github.com/mryan-iadeptive/expo-crypto-lib/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/expo-crypto-lib.svg)](https://www.npmjs.com/package/expo-crypto-lib)
[![Expo Compatible](https://img.shields.io/badge/Expo-Compatible-4630EB?style=flat-square&logo=EXPO&labelColor=f3f3f3&logoColor=000)](https://expo.dev)

If your Expo or React Native app needs to encrypt sensitive data—and you want users to recover their keys if they lose their phone—this library gives you hybrid RSA + AES encryption with mnemonic-based key recovery. No native iOS or Android code, no prebuild. Works in Node too.


### Why would I want this? 
If you need to have client-side encrypted storage, this module allows you to generate RSA keypairs locally and hash them with AES 512/256 algorithims. Since it's deterministic, the keypair can be recovered via mnemonic phrase, in this case a 24-word phrase easily exportable to Google Drive or iCloud storage.

<u>These derived keys can be stored natively in either Android Keystore or in iOS Keychain.</u> Then they can be pulled by any other native app that may need or want access via normal Keystore/Keychain permissions.


### What is one-way encryption?
**One-way encryption** refers to generating a secret (such as a cryptographic key or a seed) from something that cannot be reversed or "decrypted" back to its original form by normal means. For example, passwords or mnemonic phrases are processed through a hash function or key derivation procedure to create a cryptographic seed. This seed is then used to generate the actual keypair (RSA) for encryption and decryption.

The key property is that, while you can **derive the same keys if you have the original mnemonic or password**, you **cannot recover the original mnemonic or password just from the key or encrypted data**. This ensures that even if someone obtains the resulting encrypted files or keys, they cannot get back the original secrets unless they know the user's recovery phrase.

In contrast to reversible encryption (where something encrypted can be decrypted with the correct key), one-way encryption in expo-crypto-lib is used for **secure key derivation and recovery**: the user's mnemonic is the only path to regenerating their encryption keys in case they lose their device or app data.

### I lost my mnemonic phrase! How can I recover it?
If you did not save the 24 word phrase, there is no way to recover your lost encryption keypair. You'll need to regerenrate a new one and use the newly-generated keypair going forward. And this time, _<u>keep your phrase safe!</u>_

## Install

```bash
npm install expo-crypto-lib
```

For Expo apps, install peer dependencies:

```bash
npx expo install expo-crypto expo-secure-store
```

## Quick start

**Expo / React Native:**

```ts
import { createRSAManager } from 'expo-crypto-lib';
import { Platform } from 'react-native';

const manager = createRSAManager({ platform: 'expo', platformOS: Platform.OS });
await manager.generateRSAKeypair(2048);
const encrypted = await manager.encryptDataForLocalStorage(fileBytes);
const decrypted = await manager.decryptDataFromLocalStorage(encrypted);
```

**Node:**

```ts
const { createRSAManager } = require('expo-crypto-lib');

const manager = createRSAManager({ platform: 'node' });
await manager.generateRSAKeypair(2048);
const encrypted = await manager.encryptDataForLocalStorage(data);
const decrypted = await manager.decryptDataFromLocalStorage(encrypted);
```

See [docs/getting-started.md](docs/getting-started.md) for build options and manual setup.

## Use cases

- **Sensitive data at rest** — Encrypt credentials or PII before storing in AsyncStorage
- **Encrypted backup / transit** — Encrypt files, send to your backend or other device, decrypt after mnemonic recovery
- **Account recovery** — 24-word mnemonic lets users restore keys on a new device
- **Offline-first cache** — Encrypted local cache for health, financial, or other sensitive records
- **Multi-user apps** — User-scoped keys via custom storage adapters or `storageKeyPrefix`
- **Tests / Node** — Run crypto flows in Node without an Expo app

Full examples (including code) in [docs/use-cases.md](docs/use-cases.md).

## Features

- RSA (2048/3072-bit, OAEP) + AES-256-CBC hybrid encryption
- BIP39-like 24-word mnemonic for deterministic key recovery
- Adapters for Expo (expo-secure-store, expo-crypto) and Node
- Optional `react-native-modpow` for faster RSA keygen on RN

## Troubleshooting

- **Module not found: expo-secure-store / expo-crypto** — Run `npx expo install expo-secure-store expo-crypto`
- **Error in Node with createExpoKeyStorage** — Use `createNodeKeyStorage()` and `createNodeRandomValues()` for Node
- **EBADENGINE / unsupported Node** — Dev tooling needs Node 20.19.4+; use `nvm use` or `fnm use`

## Docs

- [Getting started](docs/getting-started.md) — Install, build, API, dependencies
- [Use cases](docs/use-cases.md) — Example scenarios with code
- [Publishing](docs/publishing.md) — npm, GitHub Packages

**Source**: [https://github.com/mryan-iadeptive/expo-crypto-lib](https://github.com/mryan-iadeptive/expo-crypto-lib)

## License

MIT

Maintained by Matthew Ryan @ HonestTech
Community contributions welcome, see [Contributing](CONTRIBUTING.MD) for how to submit for a pull request.
