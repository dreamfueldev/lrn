/**
 * Types Command
 *
 * `lrn <package> types` - lists all types/schemas in a package
 */

import type { ParsedArgs } from "../args.js";
import type { ResolvedConfig } from "../config.js";
import { loadPackage } from "../cache.js";
import { getOutputFormat, type FormatOptions, type OutputFormat } from "../format/index.js";

export function runTypes(args: ParsedArgs, config: ResolvedConfig): void {
  const packageName = args.package!;
  const version = args.packageVersion;

  const pkg = loadPackage(config, packageName, version);

  const outputFormat = getOutputFormat(args, config);

  if (!pkg.schemas || Object.keys(pkg.schemas).length === 0) {
    console.log("No types found.");
    return;
  }

  const schemas = pkg.schemas;

  if (outputFormat === "json") {
    console.log(JSON.stringify(schemas, null, 2));
    return;
  }

  // For text/markdown/summary, list type names
  const names = Object.keys(schemas).sort();

  if (outputFormat === "summary") {
    console.log(names.join("\n"));
    return;
  }

  // Text or markdown output
  const lines: string[] = [];

  if (outputFormat === "markdown") {
    lines.push("# Types");
    lines.push("");
    for (const name of names) {
      const schema = schemas[name]!;
      const type = schema.type || schema.$ref || "object";
      const desc = schema.description ? ` - ${schema.description}` : "";
      lines.push(`- \`${name}\` (${type})${desc}`);
    }
  } else {
    lines.push(`Types (${names.length}):`);
    for (const name of names) {
      const schema = schemas[name]!;
      const type = schema.type || schema.$ref || "object";
      const desc = schema.description ? `  ${schema.description}` : "";
      lines.push(`  ${name}: ${type}${desc}`);
    }
  }

  console.log(lines.join("\n"));
}
