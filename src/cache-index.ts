/**
 * Cache Index
 *
 * Manages ~/.lrn/cache-index.json tracking pulled packages.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export interface CacheEntry {
  version: string;
  pulledAt: string;
  checksum: string;
}

export interface CacheIndex {
  packages: Record<string, CacheEntry>;
}

function indexPath(cacheDir: string): string {
  return join(cacheDir, "cache-index.json");
}

/**
 * Read cache index, returning empty index if missing/corrupt.
 */
export function readCacheIndex(cacheDir: string): CacheIndex {
  try {
    const raw = readFileSync(indexPath(cacheDir), "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.packages === "object") {
      return parsed as CacheIndex;
    }
    return { packages: {} };
  } catch {
    return { packages: {} };
  }
}

/**
 * Update a single package entry in the cache index.
 */
export function updateCacheIndex(
  cacheDir: string,
  name: string,
  entry: CacheEntry,
): void {
  const index = readCacheIndex(cacheDir);
  index.packages[name] = entry;
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(indexPath(cacheDir), JSON.stringify(index, null, 2) + "\n");
}
