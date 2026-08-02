# v2 to v3: what changed and why

v3 changes **no cryptography and no API**. It narrows which Expo SDK and Node versions the
package supports, which is a breaking change for installs and nothing else.

**Migration reality, stated up front:** unlike v1 → v2, there is nothing to migrate. Data
encrypted with 2.0.0 decrypts unchanged under 3.0.0, and 2.0.0 recovery phrases derive the
same keys. If your project is already on Expo SDK 56 or newer, upgrading is a version bump
with no code change.

---

## At a glance

| | v2.0.0 | v3.0.0 |
| --- | --- | --- |
| Envelope format, key derivation, wordlist | — | **identical** |
| Public API | — | **identical** |
| `peerDependencies` on `expo`, `expo-crypto`, `expo-secure-store` | `*` | `>=56.0.0` |
| `engines.node` | `>=20.19.4` | `>=22.0.0` |
| Supported Expo SDK | anything | 57 or 56 (N and N-1) |

---

## 1. Your data is unaffected, and that is verifiable

`src/` in 3.0.0 is **byte-identical** to the `v2.0.0` tag — `git diff v2.0.0 -- src/`
produces no output. Same XChaCha20-Poly1305 at-rest envelope, same HPKE suite
(`DHKEM(X25519, HKDF-SHA256) / HKDF-SHA256 / ChaCha20Poly1305`), same PBKDF2-HMAC-SHA512
seed derivation, same BIP39 wordlist, same versioned header.

Nothing needs decrypting before you upgrade. Ciphertexts, stored seeds, stored public keys,
and recovery phrases all carry over untouched.

This is the opposite of the v1 → v2 break documented in [v1-to-v2.md](v1-to-v2.md), where
the primitives themselves were unsound. Here the primitives did not move at all.

## 2. What actually broke

### Expo SDK 55 and older no longer install

`peerDependencies` moved from `*` to `>=56.0.0` for `expo`, `expo-crypto`, and
`expo-secure-store`. On an older SDK, `npm install` now fails:

```
npm error code ERESOLVE
npm error Conflicting peer dependency: expo@56.0.0
```

Note that these peers are marked `optional` in `peerDependenciesMeta`. That does **not**
soften a version mismatch — optional excuses a peer being *absent*, not being present at the
wrong version. The install genuinely fails.

**If you are on SDK 55 or older**, stay on v2:

```bash
npm install expo-crypto-lib@2
```

v2 remains functional. It is the same cryptographic code; it simply does not declare a floor.

### Node 20 produces a warning

`engines.node` moved to `>=22.0.0`, because Node 20 reached end-of-life on 2026-04-30 and
CI no longer tests it. This is an `EBADENGINE` **warning**, not an install failure, unless
you have set `engine-strict=true`.

## 3. Why the floor has no ceiling

The supported window is the latest major of Expo and npm, or the one before it (N and N-1).
That policy is enforced against this repository's own pins by `npm run check:versions`,
which runs on every CI build and weekly.

The published `peerDependencies` deliberately carry only a **floor**, not an upper bound.
An upper bound would fail installs for anyone who upgraded to a newer Expo SDK before a
matching release of this package existed — punishing users for doing the right thing, and
fixable only by publishing again. Enforcement of the upper end lives in CI, where the
timing is ours to control.

Practically: a future SDK 58 will keep installing against 3.0.0. It is simply not something
this release has been tested against.

## 4. What did not change

- Every export, every method signature, every error code.
- The envelope format and its version byte.
- The dependency set: `@noble/*` and `@scure/*`, all still on the 1.x line.
- No native modules, no prebuild, still runs in Expo Go.

## Open caveats

- **3.0.0 has not been run on a physical device.** Both bundled apps compile for Android and
  iOS on SDK 57, but the last device run of the 20-check harness was on SDK 54. iOS has
  never been verified on any version.
- The six Expo-toolchain advisories that shipped alongside v2 are gone, but the two example
  apps still carry one upstream `uuid` advisory reachable only through the Expo CLI at build
  time. It does not affect the published package, which has no such dependency.
