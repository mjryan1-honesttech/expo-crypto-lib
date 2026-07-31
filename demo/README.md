# Demo app

An interactive tour of the library's public API, running in **Expo Go** — no native build, no prebuild.

This is not the same thing as [`example/`](../example), which is a non-interactive pass/fail harness that exists to prove the package can be bundled and run on a device. This one is for seeing what the API does, and it consumes the library from npm exactly as your own app would.

## Run it

```bash
npm install
npm start         # then scan the QR with the Expo Go app
```

`expo-crypto-lib` is an ordinary dependency here, installed from npm — so this app is wired up exactly the way yours would be. Nothing about it is special-cased for living inside the library's own repository.

If you are **changing** the library and want the demo to pick up your edits, this is the wrong app: it will keep using the published release. Use [`example/`](../example) instead, which packs the working tree with `npm run sync`.

Expo Go ships one version per SDK, so the app must match your client's major exactly — an older SDK is not a safer fallback. This app targets **SDK 54**. If yours differs:

```bash
npm install expo@~<major>.0.0
npx expo install --fix
```

## The three tabs

**Identity** — `generate()` returns a 24-word BIP39 phrase and shows it once; the seed and public key go to the iOS Keychain / Android Keystore, and the phrase is never written anywhere. `recover()` rebuilds the same key from the phrase alone. Change one word and the checksum rejects it with `INVALID_MNEMONIC`.

**At rest** — `encryptLocal()` / `decryptLocal()`, keyed off your seed. The envelope's size, version byte, and mode byte are shown as decoded by `readMode()`. *Flip a byte* corrupts the ciphertext and demonstrates that the library throws `AUTH_FAILED` instead of returning garbage.

**To a key** — `encryptFor()` / `decrypt()`: HPKE base mode (RFC 9180, X25519-HKDF-SHA256 with ChaCha20-Poly1305) to a recipient's 32-byte public key, with no handshake. A second `CryptoManager` backed by an in-memory `IKeyStorage` plays the recipient so the exchange works on one phone; the lower card does the same across two real devices by copy-and-paste.

The in-memory adapter in [`crypto.ts`](crypto.ts) is itself worth a look — it shows that `CryptoManager` is not tied to `expo-secure-store`.

## Bundle without a device

```bash
npm run bundle:android   # or bundle:ios
```

Catches Metro resolution and Hermes compilation failures on their own. A warning about `@noble/hashes/crypto.js` falling back to file-based resolution is expected and harmless.

## Not covered here

Biometric gating (`createExpoKeyStorage({ requireAuthentication: true })`) needs a development build — `expo-secure-store` does not support it in Expo Go.
