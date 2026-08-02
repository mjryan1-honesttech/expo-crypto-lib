# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

History before 3.0.0 lives in the migration guides rather than here, because the detail
matters more than a list: [v1 to v2](docs/v1-to-v2.md) and [v2 to v3](docs/v2-to-v3.md).

## [3.0.0] - 2026-08-01

No cryptographic or API changes. Data written by 2.0.0 is fully readable — `src/` is
byte-identical to the `v2.0.0` tag. The major reflects a narrowed support window only. See
[v2 to v3](docs/v2-to-v3.md).

### Changed

- **Breaking:** `peerDependencies` on `expo`, `expo-crypto`, and `expo-secure-store` moved
  from `*` to `>=56.0.0`. Installing on Expo SDK 55 or older now fails with `ERESOLVE`. Use
  `expo-crypto-lib@2` on older SDKs.
- **Breaking:** `engines.node` raised from `>=20.19.4` to `>=22.0.0`, following Node 20's
  end-of-life on 2026-04-30. This surfaces as an `EBADENGINE` warning rather than a failure
  unless `engine-strict=true` is set.
- Adopted a supported-version policy of the latest major of Expo and npm, or the one before
  it (N and N-1), enforced on every CI build and weekly by `npm run check:versions`.
- The bundled `example/` and `demo/` apps moved from Expo SDK 54 to 57.
- The published tarball no longer includes `docs/publishing.md`, which is maintainer-only.

### Added

- Registry signature and attestation verification, tiered dependency auditing that holds
  production dependencies to a stricter threshold than build tooling, and CodeQL analysis.

### Fixed

- Cleared all 12 outstanding moderate advisories in the development dependency tree by
  updating the Expo build toolchain.

### Removed

- The `postcss` dependency override, which no longer had anything to override.

[3.0.0]: https://github.com/mjryan1-honesttech/expo-crypto-lib/releases/tag/v3.0.0
