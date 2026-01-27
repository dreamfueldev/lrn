/**
 * Parse Command
 *
 * Parses a markdown directory into Package IR JSON.
 * Usage: lrn parse <directory> [--out <file>]
 */

import { writeFileSync } from "node:fs";
import type { ParsedArgs } from "../args.js";
import type { ResolvedConfig } from "../config.js";
import { ArgumentError } from "../errors.js";
import { parsePackage } from "../parse/index.js";

/**
 * Run the parse command
 */
export async function runParse(
  args: ParsedArgs,
  _config: ResolvedConfig
): Promise<void> {
  const inputPath = args.positional[0];

  if (!inputPath) {
    throw new ArgumentError(
      "Parse requires a directory path.\n\nUsage: lrn parse <directory> [--out <file>]"
    );
  }

  // Parse the directory into Package IR
  const pkg = await parsePackage(inputPath);

  // Output
  const outFile = args.options.out;
  const jsonOutput = JSON.stringify(pkg, null, 2);

  if (outFile) {
    writeFileSync(outFile, jsonOutput);
    console.log(`Wrote package IR to ${outFile}`);
  } else {
    console.log(jsonOutput);
  }
}
