# v1 to v2: what changed and why

v1 had defects that could not be fixed while preserving compatibility, so v2 is a clean break with no legacy read path. RSA, `node-forge`, and the `react-native-modpow` workaround all leave; the mnemonic becomes standard BIP39; every ciphertext becomes authenticated.

**Migration reality, stated up front:** v1.0.2 ciphertexts cannot be read by v2, and v1.0.2 recovery phrases do not derive v2 keys. Anything that must survive has to be decrypted with 1.0.2 first.

---

## At a glance

| | v1.0.2 | v2.0.0 |
| --- | --- | --- |
| Ciphertext integrity | none | AEAD on every ciphertext |
| Identity derivation | 653 ms (RSA-2048) | 2 ms (X25519) |
| Stored key material | ~2.4 KB across 4 items | 132 bytes across 2 items |
| Envelope overhead | 380 bytes | 42 bytes |
| Spec-vector tests | 0 | RFC 9180 + BIP39 |
| Runtime dependencies | 2 | 5 |

---

## 1. Cryptographic primitives

| | v1.0.2 | v2.0.0 |
| --- | --- | --- |
| Public-key | RSA-2048/3072, OAEP-SHA256 | X25519 (Curve25519 ECDH) |
| Symmetric | AES-256-**CBC** | XChaCha20-Poly1305 / ChaCha20-Poly1305 |
| Authentication | **none** | Poly1305 tag on every ciphertext |
| Construction | hand-rolled `HYBRID:` wrapper | HPKE, RFC 9180 base mode, suite `0x0020/0x0001/0x0003` |
| Implementation | `node-forge`, 37 call sites | audited `@noble` / `@scure` primitives |

The deepest change is that **v1 ciphertexts were malleable**. CBC without a MAC means anyone who can reach the stored bytes can alter the plaintext without detection, and v1's `split(":")` and 4-byte-length parser both ran on attacker-controlled input. v2 fails closed: any modification raises `AUTH_FAILED`.

The second is **interoperability**. v1's format was private to this library. v2's public-key mode is standard HPKE, so a backend in Go, Rust, Python, or Swift can decrypt with an off-the-shelf implementation.

---

## 2. Key derivation and recovery

| | v1.0.2 | v2.0.0 |
| --- | --- | --- |
| Wordlist | 2058 words, non-standard | canonical BIP39, 2048 words |
| Checksum | none | validated |
| Seed KDF | one SHA-512 pass | PBKDF2-HMAC-SHA512 × 2048 |
| Seed shape | 128 bytes of ASCII hex | 64 raw bytes |
| Behavior on a typo | silently derives a different key | throws `INVALID_MNEMONIC` |

### The v1 wordlist was corrupted, not merely custom

- It contained `voyal`, which is not an English word — apparently a mangled `voyage`.
- It omitted 13 real BIP39 words, including `actress`, `session`, and `voyage`.
- Because `actress` was missing at index 22, **every index from 22 onward was misaligned** with BIP39.
- The bit-packing loop skipped rather than shifted past the end of entropy, so **word 24 carried only 3 bits** — it was always one of the first eight words.

With no checksum on top of that, a typo landing on another valid word produced a working-looking key that decrypted nothing: silent, permanent data loss. v2 phrases are portable to any BIP39 tool.

The KDF change matters for anyone who used the passphrase option. v1 cost **one hash per guess**, which made passphrases effectively decorative.

---

## 3. What gets stored

| | v1.0.2 | v2.0.0 |
| --- | --- | --- |
| Items | 4 — private PEM, public PEM, mnemonic, metadata | 2 — seed, public key |
| Total size | ~2.4 KB | 132 bytes (88 + 44 base64) |
| Recovery phrase | written to SecureStore on every keygen | never persisted |
| SecureStore options | all silently dropped | `requireAuthentication`, `keychainAccessible`, `keychainService`, `accessGroup`, `authenticationPrompt` |
| Oversize values | silently rejected by iOS | `VALUE_TOO_LARGE` before the call |

v1 stored the recovery phrase next to the keys, so compromising the device also handed over the phrase — the one secret meant to survive device loss.

Measured: v1's RSA-3072 private PEM is **2498 bytes**, above the ~2048-byte value iOS accepts, so `RECOMMENDED_KEY_SIZE` was the setting that broke. v2 stores 64 bytes, which is also what makes biometric gating practical.

---

## 4. Ciphertext format

v1 had no version marker anywhere, so migration was impossible by construction. v2 is self-describing, and both header bytes are authenticated as associated data — so version and mode cannot be swapped.

```
byte 0   version (0x02)
byte 1   mode: 0x00 local, 0x01 hpke

mode 0x00   nonce(24) || ciphertext || tag(16)    XChaCha20-Poly1305, seed-derived local key
mode 0x01   enc(32)   || ciphertext || tag(16)    HPKE base mode to a public key

AAD = bytes 0..1
```

Overhead drops from **380 bytes to 42** for local storage. v1 wrapped the AES key with RSA and then stored the result as base64 *text*: 4 + 344 + 16 IV + 16 pad. That figure is derived from the format, not measured.

---

## 5. Failure behavior

v1 caught everything, logged to `console.error`, and returned `null`/`false`. Callers could not distinguish "no keys yet" from "wrong key" from "tampered ciphertext". v2 throws `CryptoError` with one of seven codes: `NO_KEYS`, `AUTH_FAILED`, `BAD_FORMAT`, `UNSUPPORTED_VERSION`, `INVALID_MNEMONIC`, `STORAGE_FAILED`, `VALUE_TOO_LARGE`.

For a crypto library this is a security property, not an ergonomic one: indistinguishable silent failure hides exactly the cases that matter.

---

## 6. Performance

Identity derivation, measured on the same machine:

| Operation | Time | Notes |
| --- | --- | --- |
| v1 deterministic RSA-2048 keygen | 653 ms | forge PRIMEINC with a seeded PRNG |
| v1 deterministic RSA-3072 keygen | 3163 ms | the documented "recommended" size |
| v2 PBKDF2 seed | 18 ms | 2048 iterations, per BIP39 |
| v2 X25519 derivation | 2 ms | HKDF plus scalar multiplication |

These are desktop numbers; on a mid-range phone v1 was far worse, which is precisely why `react-native-modpow` existed. v2 deletes that workaround, the `./react-native` entry point, and the peer dependency along with it.

---

## 7. API surface

`EnhancedRSAManager` becomes `CryptoManager`; `createRSAManager` becomes `createCryptoManager`. Encrypt and decrypt are now **synchronous** — only storage is async — and `encryptFor` allows encrypting to *another party's* key, which v1 could never do.

| v1.0.2 | v2.0.0 |
| --- | --- |
| `generateRSAKeypair(2048)` | `generate()` — returns the phrase, once |
| `recoverKeysFromMnemonic(m)` | `recover(m)` |
| `loadKeysFromSecureStorage()` | `load()` |
| `checkKeysInSecureStorage()` | `hasKeys()` |
| `clearKeys()` | `clear()` |
| `encryptDataForLocalStorage(d)` | `encryptLocal(d)` |
| `decryptDataFromLocalStorage(e)` | `decryptLocal(e)` |
| `prepareDataForRemoteTransmission(d)` | `encryptFor(publicKey, d)` |
| `decryptRemoteTransmissionData(k, d)` | `decrypt(envelope)` |
| `getStoredMnemonic()` | removed — nothing to read |
| `encryptWithRSA` / `decryptWithRSA` | removed |
| `validateRSAKey` | removed |
| `hashWithSHA512_256` / `hashWithSalt` | removed |
| `TransmissionPayload` / `ValidationResult` | removed |
| `ProgressCallback` | removed — keygen is instant |

---

## 8. Verification posture

v1 had 65 tests and **zero against any published specification vector**. v2 has 87 test blocks producing 95 executed cases, including:

- **RFC 9180 Appendix A.2** known-answer vectors — encapsulation, decapsulation, the key schedule, and opening the specification's own ciphertext.
- **Official BIP39 vectors** for validation and seed derivation.
- A **per-byte tamper sweep** across both envelope modes: every byte after the header, flipped one at a time.

Those vectors are what make implementing HPKE in-house defensible rather than reckless. `hpke-js` was the obvious alternative, but it is built on the Web Cryptography API, and `crypto.subtle` is absent on Hermes and in Expo Go — every polyfill for it is a native module that would have broken the library's no-prebuild promise.

---

## 9. What did not change

The adapter contracts (`IKeyStorage`, `IRandomValues`), the pure-JS no-prebuild guarantee, `storageKeyPrefix` multi-tenancy, the Node adapters, the MIT license, and the CI workflow structure all carry over unchanged.

---

## Open caveats

**Install footprint grew.** The five noble/scure packages total 6.2 MB on disk versus node-forge's 1.75 MB, because noble ships dual CJS and ESM builds plus type maps for algorithms this library never imports. Only imported modules reach an app bundle, but bundle size has not been measured — measure it in your own app if it matters.

**New runtime floor.** v2 requires React Native 0.70+ / Expo SDK 47+ with the Hermes engine, because X25519 needs `BigInt`. v1 had no such constraint.

**Verified on Android, not yet on iOS.** The library was run on a physical Android device in Expo Go (SDK 54) and all 20 checks passed: Hermes and `BigInt`, `TextEncoder`, key generation through `expo-crypto`, `encryptLocal` round-trips from 0 B to 1 MB, HPKE `encryptFor`/`decrypt`, a two-party exchange, `AUTH_FAILED` on a tampered ciphertext, `INVALID_MNEMONIC` on a bad phrase, real Keychain/Keystore persistence with no mnemonic entry, `load()`, `loadPublicKey()`, deterministic `recover()`, and `clear()`. iOS remains untested; CI cannot cover either platform.

Getting there required fixing a defect that made the package impossible to bundle for React Native at all — `index.ts` reached a `require` of Node's built-in `crypto`, which Metro resolves statically. Both 1.0.2 and the first cut of 2.0.0 shipped it, so the "runs in Expo Go" claim had never actually held. `tests/packaging.test.ts` now guards against a reshipment.

**Pre-existing repairs folded in.** `npm run ci` was already failing on `main` before this work, from an unpushed dependabot devDependency bump: expo-module-scripts 55 no longer exports `createJestPreset`, TypeScript 6 rejects `moduleResolution: "node"`, and `@typescript-eslint/parser` was installed only nested under eslint-config-universe where eslint-plugin-import could not resolve it. All three are fixed here. The `moduleResolution` fix is a deprecation acknowledgement (`ignoreDeprecations: "6.0"`), so a real migration to node16 resolution is still owed before TypeScript 7.
