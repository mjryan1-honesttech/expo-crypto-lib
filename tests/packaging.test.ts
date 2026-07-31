/**
 * Packaging guards for React Native compatibility.
 *
 * These exist because the unit suite cannot catch them: the library's central
 * claim is that it bundles for Expo Go with no native code, and that is a
 * property of the *bundler graph*, not of runtime behaviour in Node.
 *
 * v1.0.2 and the first cut of v2.0.0 both shipped `require("crypto")` in
 * nodeAdapter, reachable from the package entry point. Metro resolves
 * `require()` calls statically, so it failed with "Unable to resolve module
 * crypto" and produced no bundle at all — in Node every test still passed.
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

/** Node built-ins that must never appear in a file reachable from index.ts. */
const NODE_BUILTINS = [
  "assert",
  "buffer",
  "child_process",
  "crypto",
  "fs",
  "http",
  "https",
  "net",
  "os",
  "path",
  "stream",
  "tls",
  "url",
  "util",
  "zlib",
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith(".ts") ? [full] : [];
  });
}

/**
 * Comments are stripped before scanning: the code that documents why this guard
 * exists quotes `require("crypto")` in prose, which would otherwise trip it.
 */
function code(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("packaging", () => {
  const files = sourceFiles(join(__dirname, "..", "src"));

  it("finds the source files", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(NODE_BUILTINS)(
    "no source file references the Node built-in %s",
    (builtin) => {
      const offenders = files.filter((file) => {
        const text = code(file);
        return (
          text.includes(`require("${builtin}")`) ||
          text.includes(`require('${builtin}')`) ||
          text.includes(`from "${builtin}"`) ||
          text.includes(`from '${builtin}'`) ||
          text.includes(`require("node:${builtin}")`) ||
          text.includes(`from "node:${builtin}"`)
        );
      });
      expect(offenders).toEqual([]);
    },
  );

  // The Expo peer modules are resolved lazily and are expected; they exist in
  // any Expo app. This asserts the *only* bare requires are those two, so a
  // new one cannot slip in unnoticed.
  it("only requires expo-secure-store and expo-crypto at runtime", () => {
    const found = new Set<string>();
    for (const file of files) {
      const text = code(file);
      for (const match of text.matchAll(/require\(\s*["']([^"']+)["']\s*\)/g)) {
        found.add(match[1]);
      }
    }
    expect([...found].sort()).toEqual(["expo-crypto", "expo-secure-store"]);
  });
});
