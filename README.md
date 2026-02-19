# expo-crypto-lib

[![CI](https://github.com/mryan-iadeptive/expo-crypto-lib/actions/workflows/ci.yml/badge.svg)](https://github.com/mryan-iadeptive/expo-crypto-lib/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/expo-crypto-lib.svg)](https://www.npmjs.com/package/expo-crypto-lib)
[![Expo Compatible](https://img.shields.io/badge/Expo-Compatible-4630EB?style=flat-square&logo=EXPO&labelColor=f3f3f3&logoColor=000)](https://expo.dev)

Standalone **Expo module** providing hybrid RSA + AES encryption with mnemonic-based key derivation for React Native / Expo and Node.

This is a **JavaScript-only module**; it has no native iOS/Android code and does not require prebuild hooks.

**Requirements:** Node 18+ for local development and tests. For Expo/React Native apps: Expo SDK 50+ (or compatible), plus peer dependencies below.

## Install

```bash
npm install expo-crypto-lib
```

With Expo, ensure peer dependencies are installed (they usually are in an Expo project):

```bash
npx expo install expo-crypto expo-secure-store
```

## Quick start

### Expo / React Native (one-line manager)

```ts
import { createRSAManager } from 'expo-crypto-lib';
import { Platform } from 'react-native';

const manager = createRSAManager({ platform: 'expo', platformOS: Platform.OS });
await manager.generateRSAKeypair(2048);
const encrypted = await manager.encryptDataForLocalStorage(fileBytes);
const decrypted = await manager.decryptDataFromLocalStorage(encrypted);
```

### Node (or tests)

```ts
const { createRSAManager } = require('expo-crypto-lib');

const manager = createRSAManager({ platform: 'node' });
await manager.generateRSAKeypair(2048);
const encrypted = await manager.encryptDataForLocalStorage(data);
const decrypted = await manager.decryptDataFromLocalStorage(encrypted);
```

You can also build the manager manually with `EnhancedRSAManager`, `createExpoKeyStorage` / `createNodeKeyStorage`, and `createExpoRandomValues` / `createNodeRandomValues` (see [GETTING_STARTED.md](./GETTING_STARTED.md)).

## Features

- **RSA** (2048/3072-bit, OAEP) + **AES-256-CBC** hybrid encryption for data and keys
- **Mnemonic** (24-word BIP39-like) generation and seed derivation for deterministic key recovery
- **Adapters** for Expo (`expo-secure-store`, `expo-crypto`) and Node (in-memory + `crypto.getRandomValues`)
- **Optional** React Native performance: use `expo-crypto-lib/react-native` and `applyForgeOptimization()` with `react-native-modpow`

## Troubleshooting

- **Module not found: expo-secure-store** (or **expo-crypto**): You are using the Expo adapters in an Expo/React Native app but the peer packages are not installed. Run:
  ```bash
  npx expo install expo-secure-store expo-crypto
  ```
  Import from `expo-crypto-lib` (the main entry), not from `expo-crypto-lib/react-native`, unless you specifically need `applyForgeOptimization`.

- **Error in Node when using createExpoKeyStorage:** The Expo adapters are for React Native/Expo only. In Node or tests, use `createNodeKeyStorage()` and `createNodeRandomValues()`.

## Docs

- [GETTING_STARTED.md](./GETTING_STARTED.md) — Install, build, usage examples, API summary, dependencies
- [PUBLISHING.md](./PUBLISHING.md) — How to publish the package (npm, GitHub Packages)

**Source**: [https://github.com/mryan-iadeptive/expo-crypto-lib](https://github.com/mryan-iadeptive/expo-crypto-lib)

## License

MIT

Maintained by Matthew Ryan @ HonestTech
