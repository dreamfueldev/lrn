/**
 * lrn CLI Entry Point
 *
 * Universal CLI for learning and querying programming interfaces.
 * Handles update notifications and background version checks.
 */

import { execute } from "./api.js";

async function main(): Promise<void> {
  const cacheDir = process.env.LRN_CACHE || `${process.env.HOME || require("os").homedir()}/.lrn`;
  const argv2 = process.argv[2];
  const isUpdateCommand = argv2 === "update";

  // Determine if update checks are disabled
  const updateCheckDisabled = process.env.LRN_NO_UPDATE_CHECK === "1";

  // Show update notification (sync — just reads a cache file)
  if (!updateCheckDisabled && !isUpdateCommand && process.stderr.isTTY) {
    try {
      const { showUpdateNotification } = await import("./update.js");
      const { getVersion } = await import("./commands/help.js");
      const notification = showUpdateNotification(cacheDir, getVersion(), argv2);
      if (notification) {
        process.stderr.write(notification + "\n\n");
      }
    } catch {
      // Silently ignore notification errors
    }
  }

  // Fire background update check (non-blocking)
  if (!updateCheckDisabled) {
    import("./update.js")
      .then(({ backgroundUpdateCheck }) => {
        import("./commands/help.js").then(({ getVersion }) => {
          backgroundUpdateCheck(cacheDir, getVersion());
        });
      })
      .catch(() => {});
  }

  const result = await execute(process.argv);
  if (result.stdout) process.stdout.write(result.stdout + "\n");
  if (result.stderr) process.stderr.write(result.stderr + "\n");
  process.exit(result.exitCode);
}

main();
