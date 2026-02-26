/**
 * Guides Command
 *
 * `lrn <package> guides` - lists all guides in a package
 */

import type { ParsedArgs } from "../args.js";
import type { ResolvedConfig } from "../config.js";
import { loadPackage } from "../cache.js";
import { format, getOutputFormat, type FormatOptions } from "../format/index.js";

export function runGuides(args: ParsedArgs, config: ResolvedConfig): string {
  const packageName = args.package!;
  const version = args.packageVersion;

  const pkg = loadPackage(config, packageName, version);

  const outputFormat = getOutputFormat(args, config);
  const options: FormatOptions = {
    format: outputFormat,
    full: args.flags.full,
    packageName,
  };

  let guides = pkg.guides;

  if (args.options.tag && args.options.tag.length > 0) {
    const tags = args.options.tag;
    guides = guides.filter((g) =>
      g.tags?.some((t) => tags.some((ft) => t.toLowerCase() === ft.toLowerCase()))
    );
  }

  if (guides.length === 0) {
    return "No guides found.";
  }

  return format(guides, options);
}
