/**
 * Programmatic API
 *
 * In-process entry point for executing CLI commands.
 * The CLI entry point (index.ts) is a thin wrapper around this.
 */

import { parseArgs } from "./args.js";
import { runCommand } from "./commands/index.js";

export interface ExecuteResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Execute a CLI command programmatically.
 *
 * @param argv - Full argument vector (e.g. ["node", "lrn", "mathlib", "list"])
 * @returns Structured result with exitCode, stdout, and stderr
 */
export async function execute(argv: string[]): Promise<ExecuteResult> {
  try {
    const args = parseArgs(argv);
    const result = await runCommand(args);
    return {
      exitCode: result.exitCode,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      exitCode: 1,
      stdout: "",
      stderr: `Fatal error: ${message}`,
    };
  }
}
