/**
 * llms-full Command
 *
 * Generates an llms-full.txt file from a markdown docs directory.
 * Usage: lrn llms-full <directory> [--out <file>]
 */

import { writeFileSync } from "node:fs";
import type { ParsedArgs } from "../args.js";
import type { ResolvedConfig } from "../config.js";
import { ArgumentError } from "../errors.js";
import { parsePackage } from "../parse/index.js";
import { formatLlmsFull } from "../format/llms-full.js";

/**
 * Run the llms-full command
 */
export async function runLlmsFull(
  args: ParsedArgs,
  _config: ResolvedConfig
): Promise<string> {
  const inputPath = args.positional[0];

  if (!inputPath) {
    throw new ArgumentError(
      "llms-full requires a directory path.\n\nUsage: lrn llms-full <directory> [--out <file>]"
    );
  }

  // Parse the directory into Package IR
  const pkg = await parsePackage(inputPath);

  // Format as llms-full
  const output = formatLlmsFull(pkg);

  // Output
  const outFile = args.options.out;

  if (outFile) {
    writeFileSync(outFile, output);
    return `Wrote llms-full.txt to ${outFile}`;
  } else {
    return output;
  }
}
