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

Only files listed in `package.json` `"files"` (and always `package.json` and `README`) are included; the repo uses `dist`, `docs`, and `LICENSE`.

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

They need to point npm at GitHub Packages for your scope. In the project that uses the package (or in user's global `.npmrc`):

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
- **files**: `["dist", "expo-module.config.json", "README.md", "docs", "LICENSE"]` so published tarball includes built output and docs.
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

No npm token is needed; npm [Trusted Publishers](https://docs.npmjs.com/trusted-publishers) (OIDC) is configured for this repository with workflow filename `publish.yml`. **Publishing must stay in that file** — the OIDC trust is bound to the filename, so moving the publish step to another workflow breaks it.

There are two ways to release, both ending in the same `publish.yml`:

| | Approve-to-release | Manual tag |
| --- | --- | --- |
| Trigger | CI succeeds on `main` with an untagged version | A maintainer pushes a `v*` tag |
| Human step | Click **Review deployments → Approve** in the Actions UI | Create and push the tag |
| Tag created by | `github-actions[bot]`, inside the approved job | The maintainer |

### Approve-to-release (default)

1. Bump the version on `main` (`npm version patch`, then push, or merge a PR that bumps it).
2. **CI** runs. If it passes, **Publish Package** starts and its `Check for an unreleased version` job compares `package.json` against existing tags.
   - Version already tagged → nothing happens, and nobody is asked to approve.
   - Version not tagged → the `Release vX.Y.Z` job appears as **pending approval**.
3. A reviewer opens the run, sees that every check passed and what changed, and clicks **Approve and deploy**.
4. The approved job re-runs typecheck, lint, tests, and build, then creates and pushes `vX.Y.Z` and publishes to npm — all in one job.

Nothing is published without that click, and a push that does not change the version never asks for one.

**Why one job does both:** a tag pushed with `GITHUB_TOKEN` does not start new workflow runs, so CI cannot push a tag and rely on the tag-triggered job below to pick it up. Combined with the OIDC filename binding, that makes "tag and publish together, after approval" the only arrangement that works without a long-lived personal access token.

### Prerequisites

1. **The `release` environment** — this *is* the approval gate.
   **Settings** → **Environments** → **New environment** → name it exactly `release` → enable **Required reviewers** and add whoever may authorise a release.
   Without required reviewers the environment still works but **will not pause**, so releases become fully automatic. Optionally restrict its deployment branches to `main`.
   See [GitHub: Using environments for deployment](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).

2. **Tag rules must permit the bot.** If a `v*` tag protection rule or ruleset restricts who may create version tags, `github-actions[bot]` must be allowed to create them, or the approved job fails at the tag push. In a ruleset, add **Repository admin, or the GitHub Actions bot** to the bypass list.
   **Where to configure:** **Settings** → **Rules** → **Rulesets** (or the older **Settings** → **Tags** rule).
   See [GitHub: Configuring tag protection rules](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/configuring-tag-protection-rules).

3. **Only-from-main rule** — version tags (`v*`) must only point at commits on `main`. Both paths enforce this and fail otherwise.

### Manual tag release (still supported)

1. Ensure the version bump is on `main`.
2. From a clone with `main` checked out and up to date:
   - Bump version: `npm version patch` (or `minor` / `major`).
   - Push the version commit: `git push origin main`.
3. Create and push the tag (same version as `package.json`):
   `git tag v1.0.3 && git push origin v1.0.3`
4. **Publish Package** runs typecheck, lint, tests, and build, then publishes.

Tagging manually before the gated job is approved is safe: the tag now exists, so the version check reports nothing to release and no approval is requested. If both somehow raced, npm rejects the duplicate version.

---

## Private registries

For a private npm-compatible registry (e.g. Azure Artifacts, Verdaccio, Nexus):

1. Set `publishConfig.registry` (and optionally `publishConfig.scope`) in `package.json`, or configure registry in `.npmrc`.
2. Ensure you are logged in (or have token) for that registry.
3. Run `npm publish` from the root of this repository.
4. Document for your team how to set the registry and auth so they can run `npm install @scope/expo-crypto-lib`.

No automation (e.g. GitHub Actions) is described here; this doc is limited to the steps to list and publish the package so others can use it.
