/**
 * Package Cache
 *
 * Handles loading packages from the local cache directory.
 * Packages are stored as JSON files in ~/.lrn/packages/<name>/<version>.lrn.json
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import type { Package, PackageSpec } from "./schema/index.js";
import type { ResolvedConfig } from "./config.js";
import { getPackagesDir } from "./config.js";
import { PackageNotFoundError, findSimilar } from "./errors.js";

/**
 * Information about a cached package
 */
export interface CachedPackageInfo {
  name: string;
  version: string;
  path: string;
}

/**
 * List all cached packages
 */
export function listCachedPackages(config: ResolvedConfig): CachedPackageInfo[] {
  const packagesDir = getPackagesDir(config);

  if (!existsSync(packagesDir)) {
    return [];
  }

  const packages: CachedPackageInfo[] = [];

  try {
    const dirs = readdirSync(packagesDir);

    for (const name of dirs) {
      const pkgDir = join(packagesDir, name);
      if (!statSync(pkgDir).isDirectory()) continue;

      // Find version files
      const files = readdirSync(pkgDir).filter((f) => f.endsWith(".lrn.json"));

      for (const file of files) {
        const version = basename(file, ".lrn.json");
        packages.push({
          name,
          version,
          path: join(pkgDir, file),
        });
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
    return [];
  }

  return packages.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Load a package from cache by name
 *
 * If version is specified, loads that exact version.
 * Otherwise, loads the latest cached version.
 */
export function loadPackage(
  config: ResolvedConfig,
  name: string,
  version?: string
): Package {
  // First check if there's a local path in config
  const spec = config.packages[name];
  if (spec && typeof spec === "object" && "path" in spec && spec.path) {
    return loadPackageFromPath(spec.path, name);
  }

  // Otherwise load from cache
  const packagesDir = getPackagesDir(config);
  const pkgDir = join(packagesDir, name);

  if (!existsSync(pkgDir)) {
    // Try to find similar package names for suggestion
    const cached = listCachedPackages(config);
    const names = cached.map((p) => p.name);
    const similar = findSimilar(name, names);
    throw new PackageNotFoundError(name, similar);
  }

  // Find the requested version or latest
  const files = readdirSync(pkgDir).filter((f) => f.endsWith(".lrn.json"));

  if (files.length === 0) {
    throw new PackageNotFoundError(name);
  }

  let targetFile: string;

  if (version) {
    // Look for exact version
    targetFile = `${version}.lrn.json`;
    if (!files.includes(targetFile)) {
      throw new PackageNotFoundError(
        `${name}@${version}`,
        files.length > 0 ? `${name}@${basename(files[0]!, ".lrn.json")}` : undefined
      );
    }
  } else {
    // Use latest (last when sorted)
    const sorted = files.sort();
    targetFile = sorted[sorted.length - 1]!;
  }

  const pkgPath = join(pkgDir, targetFile);
  return loadPackageFromPath(pkgPath, name);
}

/**
 * Load a package from a specific file path
 */
export function loadPackageFromPath(path: string, expectedName?: string): Package {
  if (!existsSync(path)) {
    throw new PackageNotFoundError(expectedName || path);
  }

  try {
    const content = readFileSync(path, "utf-8");
    const pkg = JSON.parse(content) as Package;

    // Basic validation
    if (!pkg.name) {
      throw new Error("Package missing required 'name' field");
    }
    if (!Array.isArray(pkg.members)) {
      pkg.members = [];
    }
    if (!Array.isArray(pkg.guides)) {
      pkg.guides = [];
    }
    if (!pkg.schemas) {
      pkg.schemas = {};
    }

    return pkg;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in package file: ${path}`);
    }
    throw error;
  }
}

/**
 * Load all packages from cache
 */
export function loadAllPackages(config: ResolvedConfig): Package[] {
  const cached = listCachedPackages(config);
  const packages: Package[] = [];

  // Group by name and take latest version of each
  const byName = new Map<string, CachedPackageInfo>();
  for (const info of cached) {
    const existing = byName.get(info.name);
    if (!existing || info.version > existing.version) {
      byName.set(info.name, info);
    }
  }

  for (const info of byName.values()) {
    try {
      const pkg = loadPackageFromPath(info.path);
      packages.push(pkg);
    } catch {
      // Skip packages that fail to load
    }
  }

  // Also load any packages specified with local paths in config
  for (const [name, spec] of Object.entries(config.packages)) {
    if (typeof spec === "object" && "path" in spec && spec.path) {
      // Skip if already loaded from cache
      if (packages.some((p) => p.name === name)) continue;

      try {
        const pkg = loadPackageFromPath(spec.path, name);
        packages.push(pkg);
      } catch {
        // Skip packages that fail to load
      }
    }
  }

  return packages.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Check if a package exists in cache
 */
export function packageExists(config: ResolvedConfig, name: string): boolean {
  // Check local path first
  const spec = config.packages[name];
  if (spec && typeof spec === "object" && "path" in spec && spec.path) {
    return existsSync(spec.path);
  }

  // Check cache
  const packagesDir = getPackagesDir(config);
  const pkgDir = join(packagesDir, name);
  return existsSync(pkgDir);
}
