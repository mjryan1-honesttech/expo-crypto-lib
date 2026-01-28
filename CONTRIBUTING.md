# Contributing to expo-crypto-lib

Thank you for considering contributing. As a security-focused library, we maintain high standards for code quality, CI/CD, and verification.

When opening an issue, please use one of the [issue templates](.github/ISSUE_TEMPLATE/) (e.g. Bug report or Feature request) and include the requested details (Expo SDK version, platform, steps to reproduce for bugs) so we can act on it quickly.

## Security policy

If you discover a security vulnerability, **do not open a public issue.** Report it by email to the maintainers or use the repository’s **Security** tab → **Report a vulnerability**. We aim to acknowledge security reports within 24 hours.

## How to get started

1. **Fork the repository** and create your branch from `main`.
2. **Install dependencies** in the repo root:
   ```bash
   npm install
   ```
3. **Run the test suite** to confirm everything passes:
   ```bash
   npm test
   ```
4. **Test in a real environment:** Use a local Expo app and link this package (e.g. `"expo-crypto-lib": "file:../expo-crypto-lib"`) to verify behavior on iOS, Android, or web. See [GETTING_STARTED.md](GETTING_STARTED.md) for local development setup.

## Development standards

- **TypeScript:** New code must be written in TypeScript with accurate types (no `any` without justification).
- **Deterministic behavior:** Cryptographic behavior must be deterministic and consistent across iOS, Android, web, and Node. Changes that affect output (e.g. key derivation, encryption format) require tests and documentation.
- **Tests:** We use Jest. All logic-related PRs must include or update tests; run `npm test` before submitting.
- **CI:** All commits must pass the CI pipeline (typecheck, lint, test, build). PRs are merged only when CI is green. CI runs for the default branch (`main`) and for pull requests targeting it; if the default branch is renamed, the workflow in `.github/workflows/ci.yml` must be updated.

## Pull request process

1. **Link an issue:** Reference an open issue in the PR (e.g. `Fixes #123`).
2. **Linting:** Run `npm run lint` and fix any reported issues. Use the repo’s ESLint config.
3. **Typecheck and build:** Run `npm run typecheck` and `npm run build` locally.
4. **Documentation:** For new features or API changes, update the README and/or GETTING_STARTED.md and add JSDoc where appropriate.
5. **Review:** At least one maintainer must review and approve before merge. The `main` branch is protected; all changes land via pull request.

## Code of conduct

By participating in this project, you agree to uphold a respectful and professional environment. We follow the [Contributor Covenant](https://www.contributor-covenant.org/) as our Code of Conduct.

---

*Maintained by Matthew Ryan @ HonestTech*
