/**
 * Type Command
 *
 * `lrn <package> type <name>` - shows type/schema details
 */

import type { ParsedArgs } from "../args.js";
import type { ResolvedConfig } from "../config.js";
import { loadPackage } from "../cache.js";
import { TypeNotFoundError, findSimilar } from "../errors.js";
import { format, getOutputFormat, type FormatOptions } from "../format/index.js";

export function runType(args: ParsedArgs, config: ResolvedConfig): void {
  const packageName = args.package!;
  const version = args.packageVersion;
  const typeName = args.positional[0];

  const pkg = loadPackage(config, packageName, version);

  if (!pkg.schemas) {
    throw new TypeNotFoundError(packageName, typeName);
  }

  const schema = pkg.schemas[typeName];
  if (!schema) {
    const typeNames = Object.keys(pkg.schemas);
    const similar = findSimilar(typeName, typeNames);
    throw new TypeNotFoundError(packageName, typeName, similar);
  }

  const outputFormat = getOutputFormat(args, config);
  const options: FormatOptions = {
    format: outputFormat,
    full: args.flags.full,
    packageName,
    path: typeName,
  };

  console.log(format(schema, options));
}
