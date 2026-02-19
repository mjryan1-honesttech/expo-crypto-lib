# Publishing expo-crypto-lib so others can use it

This document describes **how to list and publish** the package so others can install it via npm or GitHub Packages. Source: [https://github.com/mryan-iadeptive/expo-crypto-lib](https://github.com/mryan-iadeptive/expo-crypto-lib).

---

## Pre-publish checklist

1. **Node**: Use Node 20.19.4+ (required by the dev tooling). Run `nvm use` or `fnm use` with the included `.nvmrc`.
2. **Build**: From the root of this repository run `npm run build` and ensure `dist/` is up to date.
3. **Version**: Bump `version` in `package.json` (e.g. follow [Semantic Versioning](https://semver.org/)).
4. **Access**: For **scoped** packages (`@scope/expo-crypto-lib`), confirm you have publish rights for that scope (npm org or GitHub org).
5. **Auth**: Log in to the target registry (`npm login` or GitHub Packages token). For npm, 2FA is recommended.

---

## Publishing to the public npm registry

### 1. Package name

- **Unscoped** (e.g. `expo-crypto-lib`): Ensure the name is not already taken on npm.
- **Scoped** (e.g. `@your-org/expo-crypto-lib`): Set in `package.json`:
  ```json
  "name": "@your-org/expo-crypto-lib"
  ```
  Scoped packages are private by default unless you pass `--access public`.

### 2. Publish

From the root of this repository:

```bash
# If unscoped
npm publish

# If scoped and you want the package to be public
npm publish --access public
```

Only files listed in `package.json` `"files"` (and always `package.json` and `README`) are included; the repo uses `dist`, `GETTING_STARTED.md`, and `PUBLISHING.md`.

### 3. Install for consumers

After publish, others can install with:

```bash
npm install expo-crypto-lib
# or
npm install @your-org/expo-crypto-lib
```

---

## Publishing to GitHub Packages

### 1. Scope and registry

- Use a scope that matches your GitHub org or user, e.g. `@myorg/expo-crypto-lib`.
- In `package.json`:
  ```json
  "name": "@myorg/expo-crypto-lib",
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
  ```

### 2. Authentication

Users (and CI) need a GitHub token with `read:packages` (to install) and `write:packages` (to publish). To publish once:

```bash
npm login --registry=https://npm.pkg.github.com
# Username: your GitHub username
# Password: a Personal Access Token (not your GitHub password)
# Email: your email
```

Or set in `.npmrc` (do not commit secrets; use env vars in CI):

```
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
```

### 3. Publish

From the root of this repository:

```bash
npm publish
```

### 4. Install for consumers

They need to point npm at GitHub Packages for your scope. In the project that uses the package (or in user’s global `.npmrc`):

```
@myorg:registry=https://npm.pkg.github.com
```

Then:

```bash
npm install @myorg/expo-crypto-lib
```

They must be logged in (or have auth) for `npm.pkg.github.com` if the package is private.

---

## Recommended `package.json` fields for publishing

- **name**: Unique on the registry (or scoped under your org).
- **version**: Semver (e.g. `1.0.0`).
- **main**: `"dist/index.js"`.
- **types**: `"dist/index.d.ts"`.
- **exports**: Map `"."` to the main entry and `"./react-native"` to the optional RN entry (see current `package.json`).
- **files**: `["dist", "GETTING_STARTED.md", "PUBLISHING.md"]` so published tarball includes built output and docs.
- **repository**, **license**, **author**: Optional but useful for consumers.
- **publishConfig**: Only needed for non-default registry (e.g. GitHub Packages), as above.

---

## Versioning and re-publishing

- **Patch** (1.0.x): Bug fixes, no API change → `npm version patch` then `npm publish`.
- **Minor** (1.x.0): New features, backward compatible → `npm version minor` then `npm publish`.
- **Major** (x.0.0): Breaking API change → `npm version major` then `npm publish`.

You cannot republish the same version to npm; you must bump the version first.

---

## Publishing via GitHub Actions (Trusted Publisher)

Releases to the public npm registry can be done automatically by pushing a version tag. No npm token is needed; npm [Trusted Publishers](https://docs.npmjs.com/trusted-publishers) (OIDC) is configured for this repository with workflow filename `publish.yml`.

### Prerequisites

1. **Tag protection**  
   Repository admins must add a **tag protection rule** for the pattern `v*` so that only users with **admin** or **maintain** permissions can create or delete version tags. This prevents contributors from pushing a `v*` tag and triggering a release.  
   **Where to configure:** Repository **Settings** → **Code and automation** → **Tags** → **New rule** → Tag name pattern `v*`.  
   See [GitHub: Configuring tag protection rules](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/configuring-tag-protection-rules).

2. **Only-from-main rule**  
   Version tags (`v*`) must only be created from the `main` branch (the tagged commit must be on `main`). The publish workflow enforces this and will fail if the tag is not on `main`.

### Release steps (for maintainers who can create `v*` tags)

1. Ensure the version bump is on `main` (merge a PR or commit directly on `main`).
2. From a clone with `main` checked out and up to date:
   - Bump version: `npm version patch` (or `minor` / `major`).
   - Push the version commit: `git push origin main`.
3. Create and push the tag (use the same version as in `package.json`):  
   `git tag v1.0.3 && git push origin v1.0.3`
4. The **Publish Package** workflow runs automatically. It runs typecheck, lint, tests, and build, then publishes to npm. No npm token is required (OIDC).

---

## Private registries

For a private npm-compatible registry (e.g. Azure Artifacts, Verdaccio, Nexus):

1. Set `publishConfig.registry` (and optionally `publishConfig.scope`) in `package.json`, or configure registry in `.npmrc`.
2. Ensure you are logged in (or have token) for that registry.
3. Run `npm publish` from the root of this repository.
4. Document for your team how to set the registry and auth so they can run `npm install @scope/expo-crypto-lib`.

No automation (e.g. GitHub Actions) is described here; this doc is limited to the steps to list and publish the package so others can use it.
