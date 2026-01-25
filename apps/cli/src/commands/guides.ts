/**
 * Guides Command
 *
 * `lrn <package> guides` - lists all guides in a package
 */

import type { ParsedArgs } from "../args.js";
import type { ResolvedConfig } from "../config.js";
import { loadPackage } from "../cache.js";
import { format, getOutputFormat, type FormatOptions } from "../format/index.js";

export function runGuides(args: ParsedArgs, config: ResolvedConfig): void {
  const packageName = args.package!;
  const version = args.packageVersion;

  const pkg = loadPackage(config, packageName, version);

  const outputFormat = getOutputFormat(args, config);
  const options: FormatOptions = {
    format: outputFormat,
    full: args.flags.full,
    packageName,
  };

  if (pkg.guides.length === 0) {
    console.log("No guides found.");
    return;
  }

  console.log(format(pkg.guides, options));
}
