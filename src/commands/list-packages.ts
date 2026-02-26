/**
 * List Packages Command
 *
 * `lrn` with no arguments - lists all cached packages
 */

import type { ParsedArgs } from "../args.js";
import type { ResolvedConfig } from "../config.js";
import { listCachedPackages, loadPackage } from "../cache.js";
import { format, getOutputFormat, type FormatOptions } from "../format/index.js";

export function runListPackages(args: ParsedArgs, config: ResolvedConfig): string {
  const cachedPackages = listCachedPackages(config);

  if (cachedPackages.length === 0) {
    return "No packages found. Use `lrn add <package>` to add packages.";
  }

  // Load full package data for display
  const packages = cachedPackages.map((info) => loadPackage(config, info.name, info.version));

  const outputFormat = getOutputFormat(args, config);
  const options: FormatOptions = {
    format: outputFormat,
    full: args.flags.full,
  };

  return format(packages, options);
}
