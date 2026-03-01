/**
 * Update Command
 *
 * Self-update the lrn binary to the latest version.
 */

import type { ParsedArgs } from "../args.js";
import type { ResolvedConfig } from "../config.js";
import { UpdateError } from "../errors.js";
import { getVersion } from "./help.js";
import {
  fetchLatestVersion,
  compareVersions,
  detectPlatform,
  downloadAndVerifyBinary,
  replaceBinary,
  writeUpdateCache,
  GITHUB_REPO,
} from "../update.js";

/**
 * Run the update command.
 */
export async function runUpdate(args: ParsedArgs, config: ResolvedConfig): Promise<string> {
  const currentVersion = getVersion();

  // Fetch latest version
  const latest = await fetchLatestVersion();
  if (!latest) {
    throw new UpdateError(
      "Could not check for updates.",
      "Check your internet connection or try again later.",
    );
  }

  // --check flag: just report status
  if (args.flags.check) {
    const comparison = compareVersions(currentVersion, latest);
    if (comparison === "newer") {
      return `Update available: ${currentVersion} → ${latest}\nRun 'lrn update' to install.`;
    }
    return `Already up to date (${currentVersion}).`;
  }

  // Compare versions
  const comparison = compareVersions(currentVersion, latest);
  if (comparison !== "newer") {
    // Update cache so notification doesn't show
    writeUpdateCache(config.cache, {
      latestVersion: latest,
      checkedAt: new Date().toISOString(),
    });
    return `Already up to date (${currentVersion}).`;
  }

  // Detect platform
  const platform = detectPlatform();
  if (!platform) {
    throw new UpdateError(
      "Self-update is not supported on this platform.",
      "Install manually: curl -fsSL https://uselrn.dev/install | sh",
    );
  }

  // Download and verify
  const targetPath = process.env.LRN_UPDATE_TARGET || process.execPath;
  const { binaryPath, tempDir } = await downloadAndVerifyBinary(latest, platform);

  // Replace binary
  try {
    replaceBinary(binaryPath, targetPath);
  } catch (err) {
    // Clean up temp dir on failure
    try {
      const { rmSync } = await import("node:fs");
      rmSync(tempDir, { recursive: true, force: true });
    } catch { /* ignore cleanup errors */ }
    throw err;
  }

  // Clean up temp dir
  try {
    const { rmSync } = await import("node:fs");
    rmSync(tempDir, { recursive: true, force: true });
  } catch { /* ignore cleanup errors */ }

  // Update cache
  writeUpdateCache(config.cache, {
    latestVersion: latest,
    checkedAt: new Date().toISOString(),
  });

  return `Updated lrn: ${currentVersion} → ${latest}`;
}
