#!/usr/bin/env node
//
// Fails the build when a tracked Expo package or npm is declared outside its
// supported majors: the latest major (N) or the one before it (N-1).
//
// N is resolved *per package* from that package's own dist-tags.latest, not from a
// single global "Expo SDK number". That distinction matters: expo-module-scripts has
// no SDK-57 release (it tops out at 56.x), so a gate keyed to one SDK number would be
// unsatisfiable no matter what the repo declared.
//
// Every Expo-published dependency in the manifests below is picked up automatically, so
// a package added later is gated without touching this file. That covers `expo` itself,
// `expo-*`, `@expo/*`, and the `*-expo` tooling packages such as `babel-preset-expo`,
// whose versions track the SDK too.
//
// Run: npm run check:versions

import { readFile } from 'node:fs/promises';
import semver from 'semver';

const MANIFESTS = ['package.json', 'example/package.json', 'demo/package.json'];
const BLOCKS = ['dependencies', 'devDependencies', 'peerDependencies'];
const WORKFLOWS = ['.github/workflows/ci.yml', '.github/workflows/publish.yml'];

// This repo's own package, which is a dependency of demo/ and is not version-gated here.
const SELF = 'expo-crypto-lib';

const isExpoPackage = (name) =>
  name !== SELF && (/(^|-)expo(-|$)/.test(name) || name.startsWith('@expo/'));

/** Resolve a package's latest major from the registry. One retry, then give up loudly. */
async function latestOf(name) {
  const url = `https://registry.npmjs.org/-/package/${encodeURIComponent(name)}/dist-tags`;
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const { latest } = await response.json();
      if (!semver.valid(latest)) throw new Error(`unusable "latest" tag: ${latest}`);
      return latest;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`could not resolve the latest version of "${name}": ${lastError.message}`);
}

/** Every declared range to check, as { name, range, where }. */
async function collectDeclarations() {
  const declarations = [];

  for (const file of MANIFESTS) {
    const manifest = JSON.parse(await readFile(file, 'utf8'));

    for (const block of BLOCKS) {
      for (const [name, range] of Object.entries(manifest[block] ?? {})) {
        if (isExpoPackage(name)) {
          declarations.push({ name, range, where: `${file} ${block}` });
        }
      }
    }

    // The npm policy itself. devEngines is enforced by npm before install/ci/run.
    const npmPolicy = manifest.devEngines?.packageManager?.version;
    if (npmPolicy) {
      declarations.push({ name: 'npm', range: npmPolicy, where: `${file} devEngines` });
    }
  }

  // The npm pinned in CI. These are literal versions rather than ranges, and they must
  // also agree with each other — nothing else checks that they were updated together.
  for (const file of WORKFLOWS) {
    const yaml = await readFile(file, 'utf8');
    for (const [, version] of yaml.matchAll(/npm@(\d+\.\d+\.\d+)/g)) {
      declarations.push({ name: 'npm', range: version, where: `${file} pin` });
    }
  }

  return declarations;
}

const declarations = await collectDeclarations();

const names = [...new Set(declarations.map((d) => d.name))].sort();
const latest = Object.fromEntries(
  await Promise.all(names.map(async (name) => [name, await latestOf(name)])),
);

const failures = [];
const rows = [];

for (const { name, range, where } of declarations) {
  const n = semver.major(latest[name]);
  const allowed = [n, n - 1];

  // The floor of the declared range is what goes stale, so that is what gets checked.
  // A range's upper bound is deliberately not policed: an upper bound in a published
  // peer range breaks consumers who upgrade correctly, so we do not want one.
  const floor = semver.validRange(range) ? semver.minVersion(range) : null;
  const ok = floor !== null && allowed.includes(semver.major(floor));

  if (!ok) failures.push({ name, range, where, latest: latest[name], allowed });
  rows.push([ok ? 'ok' : 'FAIL', name, range, `${n} or ${n - 1}`, latest[name], where]);
}

// npm's CI pins must be identical to each other, or the lockfile gets written by one
// version and read by another — the failure mode this repo already hit at npm 10/11.
const pins = [...new Set(declarations.filter((d) => d.where.endsWith('pin')).map((d) => d.range))];
if (pins.length > 1) {
  failures.push({ mismatch: pins });
}

const widthOf = (column) => rows.reduce((max, row) => Math.max(max, row[column].length), 0);
const [nameWidth, rangeWidth] = [widthOf(1), widthOf(2)];
for (const [status, name, range, allowed, current, where] of rows) {
  console.log(
    `${status.padEnd(5)} ${name.padEnd(nameWidth)}  ${range.padEnd(rangeWidth)}  ` +
      `majors ${allowed.padEnd(9)} latest ${current.padEnd(9)} ${where}`,
  );
}

if (failures.length === 0) {
  console.log(`\nAll ${rows.length} declarations are within N or N-1.`);
  process.exit(0);
}

console.error('\nVersion policy violations:\n');
for (const failure of failures) {
  if (failure.mismatch) {
    console.error(`  npm is pinned to more than one version in CI: ${failure.mismatch.join(', ')}`);
    continue;
  }
  const { name, range, where, latest: current, allowed } = failure;
  console.error(
    `  ${name} is declared as "${range}" in ${where}, which allows major ` +
      `${semver.validRange(range) ? semver.major(semver.minVersion(range)) : '(invalid range)'}. ` +
      `Latest is ${current}, so only majors ${allowed.join(' and ')} are supported.`,
  );
}
console.error('\nUpgrade the declarations above, or the policy in scripts/check-versions.mjs.');
process.exit(1);
