/**
 * Update System
 *
 * Background version checking, update notifications, and self-update logic.
 */

import { readFileSync, writeFileSync, mkdirSync, renameSync, copyFileSync, chmodSync, unlinkSync } from "node:fs";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { BinaryChecksumError, UpdateError } from "./errors.js";

// ============================================================
// Constants
// ============================================================

export const GITHUB_REPO = "dreamfueldev/lrn";
export const CHECK_COOLDOWN_MS = 3_600_000; // 1 hour
const GITHUB_API_BASE = process.env.LRN_GITHUB_API_BASE || "https://api.github.com";

// ============================================================
// Types
// ============================================================

export interface UpdateCheckCache {
  latestVersion: string;
  checkedAt: string;
}

export interface PlatformInfo {
  os: "darwin" | "linux";
  arch: "x64" | "arm64";
}

// ============================================================
// Cache Functions
// ============================================================

/**
 * Read the update check cache file.
 * Returns null if missing, corrupt, or unreadable.
 */
export function readUpdateCache(cacheDir: string): UpdateCheckCache | null {
  const cachePath = join(cacheDir, "update-check.json");
  try {
    if (!existsSync(cachePath)) return null;
    const content = readFileSync(cachePath, "utf-8");
    const data = JSON.parse(content);
    if (typeof data.latestVersion !== "string" || typeof data.checkedAt !== "string") {
      return null;
    }
    return data as UpdateCheckCache;
  } catch {
    return null;
  }
}

/**
 * Write the update check cache file.
 */
export function writeUpdateCache(cacheDir: string, data: UpdateCheckCache): void {
  const cachePath = join(cacheDir, "update-check.json");
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(cachePath, JSON.stringify(data, null, 2) + "\n");
}

/**
 * Whether enough time has passed to check for updates again.
 */
export function shouldCheckForUpdate(cache: UpdateCheckCache | null, cooldownMs: number = CHECK_COOLDOWN_MS): boolean {
  if (!cache) return true;
  const elapsed = Date.now() - new Date(cache.checkedAt).getTime();
  return elapsed >= cooldownMs;
}

// ============================================================
// Version Comparison
// ============================================================

/**
 * Compare two semver version strings.
 * Returns "newer" if latest > current, "same" if equal, "older" if latest < current.
 */
export function compareVersions(current: string, latest: string): "newer" | "same" | "older" {
  const c = current.replace(/^v/, "");
  const l = latest.replace(/^v/, "");

  if (c === l) return "same";

  // Use Bun.semver if available, otherwise manual comparison
  if (typeof Bun !== "undefined" && Bun.semver) {
    const order = Bun.semver.order(l, c);
    if (order > 0) return "newer";
    if (order < 0) return "older";
    return "same";
  }

  // Fallback: manual semver comparison
  const parse = (v: string) => {
    const [main, pre] = v.split("-");
    const parts = (main || "").split(".").map(Number);
    return { major: parts[0] || 0, minor: parts[1] || 0, patch: parts[2] || 0, pre };
  };

  const cv = parse(c);
  const lv = parse(l);

  if (lv.major !== cv.major) return lv.major > cv.major ? "newer" : "older";
  if (lv.minor !== cv.minor) return lv.minor > cv.minor ? "newer" : "older";
  if (lv.patch !== cv.patch) return lv.patch > cv.patch ? "newer" : "older";

  // Pre-release: no pre-release > has pre-release
  if (!lv.pre && cv.pre) return "newer";
  if (lv.pre && !cv.pre) return "older";

  return "same";
}

// ============================================================
// Notification
// ============================================================

/**
 * Build a boxed update notification string.
 */
export function formatUpdateNotification(current: string, latest: string): string {
  const c = current.replace(/^v/, "");
  const l = latest.replace(/^v/, "");
  const message = `Update available: ${c} → ${l}`;
  const action = "Run 'lrn update' to install";
  const width = Math.max(message.length, action.length) + 4;

  const top = "┌" + "─".repeat(width) + "┐";
  const bottom = "└" + "─".repeat(width) + "┘";
  const pad = (s: string) => "│  " + s + " ".repeat(width - s.length - 2) + "│";

  return [top, pad(message), pad(action), bottom].join("\n");
}

/**
 * Check cache and return notification string if an update is available.
 * Returns null if no update, cache missing, or command is "update".
 */
export function showUpdateNotification(
  cacheDir: string,
  currentVersion: string,
  command?: string,
): string | null {
  if (command === "update") return null;

  const cache = readUpdateCache(cacheDir);
  if (!cache) return null;

  const comparison = compareVersions(currentVersion, cache.latestVersion);
  if (comparison !== "newer") return null;

  return formatUpdateNotification(currentVersion, cache.latestVersion);
}

// ============================================================
// GitHub API
// ============================================================

/**
 * Fetch the latest release version from GitHub.
 * Returns the version string (without `v` prefix) or null on any error.
 */
export async function fetchLatestVersion(repo: string = GITHUB_REPO): Promise<string | null> {
  try {
    const url = `${GITHUB_API_BASE}/repos/${repo}/releases/latest`;
    const response = await fetch(url, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) return null;
    const data = await response.json() as { tag_name?: string };
    if (!data.tag_name) return null;
    return data.tag_name.replace(/^v/, "");
  } catch {
    return null;
  }
}

// ============================================================
// Background Check
// ============================================================

/**
 * Fire-and-forget background update check.
 * Checks throttle, fetches latest version, writes cache.
 * All errors are silently caught.
 */
export async function backgroundUpdateCheck(
  cacheDir: string,
  currentVersion: string,
): Promise<void> {
  try {
    const cache = readUpdateCache(cacheDir);
    if (!shouldCheckForUpdate(cache)) return;

    const latest = await fetchLatestVersion();
    if (!latest) return;

    writeUpdateCache(cacheDir, {
      latestVersion: latest,
      checkedAt: new Date().toISOString(),
    });
  } catch {
    // Silently ignore all errors
  }
}

// ============================================================
// Platform Detection
// ============================================================

/**
 * Detect current platform and architecture.
 * Returns null if unsupported (e.g., Windows).
 */
export function detectPlatform(): PlatformInfo | null {
  const platform = process.platform;
  const arch = process.arch;

  let os: PlatformInfo["os"];
  if (platform === "darwin") os = "darwin";
  else if (platform === "linux") os = "linux";
  else return null;

  let cpuArch: PlatformInfo["arch"];
  if (arch === "x64") cpuArch = "x64";
  else if (arch === "arm64") cpuArch = "arm64";
  else return null;

  return { os, arch: cpuArch };
}

/**
 * Get the binary asset name for a given platform.
 */
export function getBinaryAssetName(platform: PlatformInfo): string {
  return `lrn-${platform.os}-${platform.arch}`;
}

// ============================================================
// Download & Verify
// ============================================================

/**
 * Download binary and checksums, verify SHA-256.
 * Returns path to verified binary and temp directory.
 */
export async function downloadAndVerifyBinary(
  version: string,
  platform: PlatformInfo,
  repo: string = GITHUB_REPO,
): Promise<{ binaryPath: string; tempDir: string }> {
  const assetName = getBinaryAssetName(platform);
  const tag = `v${version.replace(/^v/, "")}`;
  const baseUrl = `https://github.com/${repo}/releases/download/${tag}`;

  const tempDir = join(tmpdir(), `lrn-update-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });

  // Download binary
  const binaryUrl = `${baseUrl}/${assetName}`;
  const binaryResponse = await fetch(binaryUrl);
  if (!binaryResponse.ok) {
    throw new UpdateError(`Failed to download binary: HTTP ${binaryResponse.status}`, `URL: ${binaryUrl}`);
  }
  const binaryPath = join(tempDir, assetName);
  const binaryData = new Uint8Array(await binaryResponse.arrayBuffer());
  writeFileSync(binaryPath, binaryData);

  // Download checksums
  const checksumsUrl = `${baseUrl}/checksums.txt`;
  const checksumsResponse = await fetch(checksumsUrl);
  if (!checksumsResponse.ok) {
    throw new UpdateError(`Failed to download checksums: HTTP ${checksumsResponse.status}`);
  }
  const checksumsText = await checksumsResponse.text();

  // Find expected checksum
  const expectedLine = checksumsText
    .split("\n")
    .find((line) => line.includes(assetName));
  if (!expectedLine) {
    throw new UpdateError(`No checksum found for ${assetName} in checksums.txt`);
  }
  const expectedHash = expectedLine.split(/\s+/)[0]!;

  // Compute actual checksum
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(binaryData);
  const actualHash = hasher.digest("hex");

  if (actualHash !== expectedHash) {
    throw new BinaryChecksumError(expectedHash, actualHash);
  }

  return { binaryPath, tempDir };
}

// ============================================================
// Binary Replacement
// ============================================================

/**
 * Replace the current binary with a new one.
 * Uses atomic rename when possible, falls back to copy for cross-filesystem.
 */
export function replaceBinary(newPath: string, targetPath: string): void {
  // Check write permission by trying to access the target directory
  const targetDir = dirname(targetPath);
  try {
    // Test writability by opening for append (doesn't modify content)
    const testPath = join(targetDir, `.lrn-update-test-${Date.now()}`);
    writeFileSync(testPath, "");
    unlinkSync(testPath);
  } catch {
    throw new UpdateError(
      `Permission denied: cannot write to ${targetDir}`,
      `Try 'sudo lrn update' or install manually with:\n  curl -fsSL https://uselrn.dev/install | sh`,
    );
  }

  try {
    // Try atomic rename first
    renameSync(newPath, targetPath);
  } catch {
    // Fallback to copy (cross-filesystem)
    copyFileSync(newPath, targetPath);
  }

  chmodSync(targetPath, 0o755);
}
