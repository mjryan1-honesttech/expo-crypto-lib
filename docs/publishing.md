# Publishing expo-crypto-lib so others can use it

This document describes **how to list and publish** the package so others can install it via npm or GitHub Packages. Source: [https://github.com/mjryan1-honesttech/expo-crypto-lib](https://github.com/mjryan1-honesttech/expo-crypto-lib).

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
- **exports**: Map `"."` to the main entry (see current `package.json`). v2 removed the `"./react-native"` subpath along with the forge optimization it existed for.
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

No npm token is needed: publishing uses npm [Trusted Publishers](https://docs.npmjs.com/trusted-publishers) (OIDC). **Publishing must stay in `publish.yml`** — the OIDC trust is bound to the workflow filename, so moving the publish step to another workflow breaks it.

> **This has to be configured on npmjs.com before a release can succeed.** The first attempt at releasing 2.0.0 failed with a misleading `E404` because OIDC never engaged. Verify it rather than assuming: npmjs.com → the package → **Settings** → **Trusted Publisher**. Version 1.0.2 was published by hand (it carries no provenance attestation), so this path had never run before.

There are two ways to release, both ending in the same `publish.yml`, and **both requiring an approval click** — nothing reaches npm without one:

| | Approve-to-release | Manual tag |
| --- | --- | --- |
| Trigger | CI succeeds on `main` with an untagged version | A maintainer pushes a `v*` tag |
| Tag created by | `github-actions[bot]`, inside the approved job | The maintainer, before the run starts |
| Approval | Required — the `release` environment | Required — the same environment |

### Approve-to-release (default)

1. Bump the version on `main` (`npm version patch`, then push, or merge a PR that bumps it).
2. **CI** runs. If it passes, **Publish Package** starts and its `Check for an unreleased version` job compares `package.json` against existing tags.
   - Version already tagged → nothing happens, and nobody is asked to approve.
   - Version not tagged → the `Release vX.Y.Z` job appears as **pending approval**.
3. A reviewer opens the run, sees that every check passed and what changed, and clicks **Approve and deploy**.
4. The approved job re-runs typecheck, lint, tests, and build, **publishes to npm, and only then pushes `vX.Y.Z`**.

The tag comes last on purpose. Tagging first is what broke the 2.0.0 attempt: publishing failed, the tag survived, and every retry path was blocked — the version check skips an already-tagged version, re-pushing an existing tag is a no-op, and re-running the job died on "tag already exists". With this order, a failed publish leaves no tag and the next CI run on `main` simply offers the release again. If publishing succeeds and tagging fails, push the tag by hand.

Nothing is published without that click, and a push that does not change the version never asks for one.

**Why one job does both:** a tag pushed with `GITHUB_TOKEN` does not start new workflow runs, so CI cannot push a tag and rely on the tag-triggered job below to pick it up. Combined with the OIDC filename binding, that makes "tag and publish together, after approval" the only arrangement that works without a long-lived personal access token.

### Prerequisites

1. **The `release` environment** — this *is* the approval gate, and it protects both release paths.
   **Settings** → **Environments** → **New environment** → name it exactly `release` → enable **Required reviewers** and add whoever may authorise a release.
   - Up to 6 users or teams may be listed, and **only one of them needs to approve** for the job to proceed. There is no built-in "two of three" — for that, chain two jobs on two environments with one reviewer each.
   - **Prevent self-review** stops whoever triggered the run from approving their own release.
   - An optional **wait timer** delays the job even after approval.
   - Without required reviewers the environment still works but **never pauses**, so releases become fully automatic on every version bump. Optionally restrict its deployment branches to `main`.

   See [GitHub: Managing environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).

2. **Do not restrict who may *create* `v*` tags.** `github-actions[bot]` **cannot** be added to a ruleset bypass list — eligible bypass actors are repository/organization/enterprise admin roles, the maintain/write roles, non-secret teams, GitHub Apps, and Dependabot. System bots are not bypassable. A ruleset that restricts tag creation therefore blocks the approved release job at its tag push.

   The `release` environment replaces that protection where it matters: a `v*` tag created by anyone publishes **nothing** until a reviewer approves the job. Protecting tag *deletion* is still fine and does not interfere.

   If you specifically need tag-name protection as well, the supported route is a **GitHub App** — create one, add it to the ruleset bypass list, and mint a token with [`actions/create-github-app-token`](https://github.com/actions/create-github-app-token) for the tag push. That is more moving parts (App registration, install, App ID and private key as secrets) for a guarantee the environment gate already provides.

   **Where to check what exists today:** **Settings** → **Rules** → **Rulesets**, and the older **Settings** → **Tags**.

3. **Trusted Publisher values must name the real repository.** Enter these on npmjs.com exactly:

   | Field | Value |
   | --- | --- |
   | Organization or user | `mjryan1-honesttech` |
   | Repository | `expo-crypto-lib` |
   | Workflow filename | `publish.yml` |
   | Environment | blank, or `release` |

   The owner is easy to get wrong: this repository was previously documented as `mryan-iadeptive` everywhere, including in npm's own metadata for 1.0.2. Only `mjryan1-honesttech` matches where the workflow actually runs. If you pin an **environment** in the npm configuration it must be `release`, since both publishing jobs run there.

4. **`package.json` `repository.url` must match the publishing repository, case-sensitively.** Trusted publishing generates provenance automatically, and provenance validates that URL against the repository the OIDC token came from. A mismatch fails the publish. It is currently `git+https://github.com/mjryan1-honesttech/expo-crypto-lib.git` — keep it in step if the repository ever moves.

5. **Only-from-main rule** — version tags (`v*`) must only point at commits on `main`. Both paths enforce this and fail otherwise.

### Two workflow details that are easy to undo by accident

- **No `registry-url` on `actions/setup-node` in the publishing jobs.** When `registry-url` is set, setup-node always writes `_authToken=${NODE_AUTH_TOKEN}` into `.npmrc`. With no token supplied, npm uses setup-node's literal placeholder instead of performing the OIDC exchange, and the registry answers `E404` — which is what happened on the first 2.0.0 attempt. See [actions/setup-node#1551](https://github.com/actions/setup-node/issues/1551). npm already defaults to registry.npmjs.org, so the input is unnecessary. There is no `auth-token-line` input to disable the behaviour; that is a proposal in the issue, not a shipped option.
- **Node 24 in the publishing jobs.** Trusted publishing requires Node ≥ 22.14.0. The rest of CI still tests on Node 20 and 22, which is unrelated.

### Manual tag release (still supported)

1. Ensure the version bump is on `main`.
2. From a clone with `main` checked out and up to date:
   - Bump version: `npm version patch` (or `minor` / `major`).
   - Push the version commit: `git push origin main`.
3. Create and push the tag (same version as `package.json`):
   `git tag v2.0.1 && git push origin v2.0.1`
4. **Publish Package** starts and waits on the `release` environment. After a reviewer approves, it runs typecheck, lint, tests, and build, then publishes. It does not create a tag on this path — you already did.

Pushing a `v*` tag therefore does not publish on its own — the approval is still required.

Tagging manually before the gated job is approved is safe: the tag now exists, so the version check reports nothing to release and no approval is requested. If both somehow raced, npm rejects the duplicate version.

---

## Private registries

For a private npm-compatible registry (e.g. Azure Artifacts, Verdaccio, Nexus):

1. Set `publishConfig.registry` (and optionally `publishConfig.scope`) in `package.json`, or configure registry in `.npmrc`.
2. Ensure you are logged in (or have token) for that registry.
3. Run `npm publish` from the root of this repository.
4. Document for your team how to set the registry and auth so they can run `npm install @scope/expo-crypto-lib`.

No automation (e.g. GitHub Actions) is described here; this doc is limited to the steps to list and publish the package so others can use it.
