/**
 * Test fixture utilities
 *
 * Provides helpers for loading fixture packages and configs in tests.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Package, LrnConfig } from "../../src/schema/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Directory containing fixture packages
 */
export const PACKAGES_DIR = join(__dirname, "packages");

/**
 * Directory containing fixture configs
 */
export const CONFIG_DIR = join(__dirname, "config");

/**
 * Available fixture package names
 */
export const FIXTURE_PACKAGES = ["mathlib", "acme-api", "uikit", "mycli", "infra-aws"] as const;
export type FixturePackageName = (typeof FIXTURE_PACKAGES)[number];

/**
 * Load a fixture package by name
 */
export function loadFixturePackage(name: FixturePackageName): Package {
  const filePath = join(PACKAGES_DIR, `${name}.lrn.json`);
  const content = readFileSync(filePath, "utf-8");
  return JSON.parse(content) as Package;
}

/**
 * Load all fixture packages
 */
export function loadAllFixturePackages(): Package[] {
  return FIXTURE_PACKAGES.map((name) => loadFixturePackage(name));
}

/**
 * Get the path to a fixture package file
 */
export function getFixturePackagePath(name: FixturePackageName): string {
  return join(PACKAGES_DIR, `${name}.lrn.json`);
}

/**
 * Available fixture config names
 */
export const FIXTURE_CONFIGS = [
  "basic",
  "with-local-path",
  "invalid",
] as const;
export type FixtureConfigName = (typeof FIXTURE_CONFIGS)[number];

/**
 * Load a fixture config by name
 */
export function loadFixtureConfig(name: FixtureConfigName): LrnConfig {
  const filePath = join(CONFIG_DIR, `${name}.json`);
  const content = readFileSync(filePath, "utf-8");
  return JSON.parse(content) as LrnConfig;
}

/**
 * Get the path to a fixture config file
 */
export function getFixtureConfigPath(name: FixtureConfigName): string {
  return join(CONFIG_DIR, `${name}.json`);
}

/**
 * Get the path to the malformed config file (for error testing)
 */
export function getMalformedConfigPath(): string {
  return join(CONFIG_DIR, "malformed.txt");
}

/**
 * Pre-loaded fixtures for quick access in tests
 */
export const fixtures = {
  mathlib: loadFixturePackage("mathlib"),
  acmeApi: loadFixturePackage("acme-api"),
  uikit: loadFixturePackage("uikit"),
  mycli: loadFixturePackage("mycli"),
  infraAws: loadFixturePackage("infra-aws"),
  config: {
    basic: loadFixtureConfig("basic"),
    withLocalPath: loadFixtureConfig("with-local-path"),
    invalid: loadFixtureConfig("invalid"),
  },
};

/**
 * Helper to create a temporary cache directory for testing
 * Returns cleanup function
 */
export function createTestCache(packages: Package[]): {
  cacheDir: string;
  cleanup: () => void;
} {
  const { mkdtempSync, writeFileSync, rmSync } = require("node:fs");
  const { tmpdir } = require("node:os");

  const cacheDir = mkdtempSync(join(tmpdir(), "lrn-test-"));
  const packagesDir = join(cacheDir, "packages");
  require("node:fs").mkdirSync(packagesDir, { recursive: true });

  for (const pkg of packages) {
    const pkgDir = join(packagesDir, pkg.name);
    require("node:fs").mkdirSync(pkgDir, { recursive: true });
    const filePath = join(pkgDir, `${pkg.version || "latest"}.lrn.json`);
    writeFileSync(filePath, JSON.stringify(pkg, null, 2));
  }

  return {
    cacheDir,
    cleanup: () => rmSync(cacheDir, { recursive: true, force: true }),
  };
}

/**
 * Helper to run CLI and capture output
 */
export interface CLIResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function runCLI(
  args: string[],
  options: { env?: Record<string, string>; cwd?: string } = {}
): Promise<CLIResult> {
  // Lazy import to avoid circular dependency at module load time
  const { execute } = await import("../../src/api.js");

  const savedEnv = { ...process.env };
  if (options.env) {
    Object.assign(process.env, options.env);
  }

  try {
    const result = await execute(["node", "lrn", ...args]);
    return {
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
      exitCode: result.exitCode,
    };
  } finally {
    // Restore environment
    for (const key of Object.keys(process.env)) {
      if (!(key in savedEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, savedEnv);
  }
}
