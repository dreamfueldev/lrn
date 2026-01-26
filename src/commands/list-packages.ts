/**
 * List Packages Command
 *
 * `lrn` with no arguments - lists all cached packages
 */

import type { ParsedArgs } from "../args.js";
import type { ResolvedConfig } from "../config.js";
import { listCachedPackages, loadPackage } from "../cache.js";
import { format, getOutputFormat, type FormatOptions } from "../format/index.js";

export function runListPackages(args: ParsedArgs, config: ResolvedConfig): void {
  const cachedPackages = listCachedPackages(config);

  if (cachedPackages.length === 0) {
    console.log("No packages found. Use `lrn add <package>` to add packages.");
    return;
  }

  // Load full package data for display
  const packages = cachedPackages.map((info) => loadPackage(config, info.name, info.version));

  const outputFormat = getOutputFormat(args, config);
  const options: FormatOptions = {
    format: outputFormat,
    full: args.flags.full,
  };

  console.log(format(packages, options));
}
