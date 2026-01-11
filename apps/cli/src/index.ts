/**
 * lrn CLI Entry Point
 *
 * Universal CLI for learning and querying programming interfaces.
 */

import { parseArgs } from "./args.js";
import { runCommand } from "./commands/index.js";

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const result = await runCommand(args);
  process.exit(result.exitCode);
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  if (process.env.LRN_DEBUG) {
    console.error(err.stack);
  }
  process.exit(1);
});
