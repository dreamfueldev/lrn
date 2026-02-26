/**
 * Health Command
 *
 * Validates lrn-compatible markdown against the specification.
 */

import type { ParsedArgs } from "../args.js";
import type { CommandResult } from "./index.js";
import { CLIError } from "../errors.js";
import { runHealthWithOutput, type HealthOptions } from "../health/index.js";

/**
 * Parse health-specific options from args
 */
function parseHealthOptions(args: ParsedArgs): HealthOptions {
  const raw = args.raw;

  return {
    json: args.flags.json,
    verbose: args.flags.verbose,
    errorsOnly: raw.includes("--errors"),
    warnings: raw.includes("--warnings"),
    fix: raw.includes("--fix"),
  };
}

/**
 * Run the health command
 */
export async function runHealthCommand(args: ParsedArgs): Promise<CommandResult> {
  // Get path from positional args
  const path = args.positional[0];
  if (!path) {
    throw new CLIError(
      "Missing path argument",
      1,
      "Usage: lrn health <path> [options]"
    );
  }

  // Parse options
  const options = parseHealthOptions(args);

  try {
    const { output, exitCode } = await runHealthWithOutput(path, options);

    return { exitCode, stdout: output };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.includes("ENOENT") || err.message.includes("does not exist")) {
        throw new CLIError(`Path not found: ${path}`, 1);
      }
      throw new CLIError(err.message, 1);
    }
    throw err;
  }
}
