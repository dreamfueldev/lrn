/**
 * lrn CLI Entry Point
 *
 * Universal CLI for learning and querying programming interfaces.
 */

import { execute } from "./api.js";

async function main(): Promise<void> {
  const result = await execute(process.argv);
  if (result.stdout) process.stdout.write(result.stdout + "\n");
  if (result.stderr) process.stderr.write(result.stderr + "\n");
  process.exit(result.exitCode);
}

main();
