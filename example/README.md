# On-device verification harness

Runs the library's real flows inside **Expo Go** and reports pass/fail for each. It exists because the most important claim this package makes — pure JavaScript, no native code, no prebuild, runs in Expo Go — is a property of the *bundler graph and the device runtime*, which the Node test suite cannot check.

That is not hypothetical. Both 1.0.2 and the first cut of 2.0.0 shipped a `require` of Node's built-in `crypto` reachable from `src/index.ts`. Metro resolves `require` calls statically, so the package could not be bundled by any React Native app, while all 112 Node tests passed. This harness is what found it.

## Run it

```bash
npm install       # the app's own dependencies
npm run sync      # build + pack the library, then install that tarball
npm start         # then scan the QR with the Expo Go app
```

`sync` installs the **packed tarball**, exactly what a consumer downloads from npm, rather than a `file:` link. That tests the published surface and sidesteps Metro's symlink resolution. Re-run `npm run sync` after any change to the library, and after any plain `npm install` (the tarball is installed with `--no-save`, so a reinstall can prune it).

## Match your Expo Go version

Expo Go ships **one version per SDK**, so the app must match the client's major exactly — an older SDK is not a safer fallback. Check the version on the Expo Go home screen, then align:

```bash
npm install expo@~<major>.0.0
npx expo install --fix
```

This app targets **SDK 57**. Scan with Expo Go's own scanner, not the system camera, and keep the phone on the same network as the dev server.

## Bundle without a device

Catches Metro resolution and Hermes compilation failures on their own, no phone or simulator needed:

```bash
npm run bundle:android   # or bundle:ios
```

A non-zero exit or an "Unable to resolve module" error means the library cannot be bundled — the exact failure mode described above.

## What it checks

20 checks, in order: Hermes present, `BigInt` (X25519 needs it), `TextEncoder` (`hpke.ts` constructs one at module scope), `generate()` through `expo-crypto`, public key shape, `encryptLocal` round-trips at 0 B / 1 B / 1 KB / 64 KB / 1 MB with timings, HPKE `encryptFor` and `decrypt`, a two-manager peer exchange, `AUTH_FAILED` on a tampered ciphertext, `INVALID_MNEMONIC` on a bad phrase, real Keychain/Keystore persistence with the seed under the 2048-byte iOS ceiling, **absence** of any stored mnemonic, `load()` in a fresh manager, `loadPublicKey()` without touching the seed, deterministic `recover()`, and `clear()`.

Biometric gating (`requireAuthentication`) is deliberately not exercised: `expo-secure-store` does not support it in Expo Go, so it needs a development build.

## Status

Android, Expo Go **SDK 54**, physical device: **all 20 passed**. iOS: not yet run.

That device run predates the SDK 57 upgrade. On SDK 57 the app bundles cleanly for both
Android and iOS, but **no device run has happened yet** — do not read the SDK 54 result as
covering it.
