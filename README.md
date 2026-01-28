# expo-crypto-lib

Standalone **Expo module** providing hybrid RSA + AES encryption with mnemonic-based key derivation for React Native / Expo and Node.

## Install

```bash
npm install expo-crypto-lib
```

With Expo, ensure peer dependencies are installed (they usually are in an Expo project):

```bash
npx expo install expo-crypto expo-secure-store
```

## Quick start

### Expo / React Native

```ts
import {
  EnhancedRSAManager,
  createExpoKeyStorage,
  createExpoRandomValues,
} from 'expo-crypto-lib';
import { Platform } from 'react-native';

const manager = new EnhancedRSAManager({
  keyStorage: createExpoKeyStorage(),
  randomValues: createExpoRandomValues(),
  platform: Platform.OS,
});

await manager.generateRSAKeypair(2048);
const encrypted = await manager.encryptDataForLocalStorage(fileBytes);
const decrypted = await manager.decryptDataFromLocalStorage(encrypted);
```

### Node (or tests)

```ts
const {
  EnhancedRSAManager,
  createNodeKeyStorage,
  createNodeRandomValues,
} = require('expo-crypto-lib');

const manager = new EnhancedRSAManager({
  keyStorage: createNodeKeyStorage(),
  randomValues: createNodeRandomValues(),
  platform: 'node',
});

await manager.generateRSAKeypair(2048);
const encrypted = await manager.encryptDataForLocalStorage(data);
const decrypted = await manager.decryptDataFromLocalStorage(encrypted);
```

## Features

- **RSA** (2048/3072-bit, OAEP) + **AES-256-CBC** hybrid encryption for data and keys
- **Mnemonic** (24-word BIP39-like) generation and seed derivation for deterministic key recovery
- **Adapters** for Expo (`expo-secure-store`, `expo-crypto`) and Node (in-memory + `crypto.getRandomValues`)
- **Optional** React Native performance: use `expo-crypto-lib/react-native` and `applyForgeOptimization()` with `react-native-modpow`

## Docs

- [GETTING_STARTED.md](./GETTING_STARTED.md) — Install, build, usage examples, API summary, dependencies
- [PUBLISHING.md](./PUBLISHING.md) — How to publish the package (npm, GitHub Packages)

**Source**: [https://github.com/mryan-iadeptive/expo-crypto-lib](https://github.com/mryan-iadeptive/expo-crypto-lib)

## License

MIT
