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
import type { Member } from "../schema/index.js";

export function runType(args: ParsedArgs, config: ResolvedConfig): string {
  const packageName = args.package!;
  const version = args.packageVersion;
  const typeName = args.positional[0];

  if (!typeName) {
    throw new TypeNotFoundError(packageName, "");
  }

  const pkg = loadPackage(config, packageName, version);
  const outputFormat = getOutputFormat(args, config);

  // Multi-type query: comma-separated names
  if (typeName.includes(",")) {
    const names = typeName.split(",").map(n => n.trim()).filter(Boolean);
    const results: string[] = [];
    for (const name of names) {
      const schema = pkg.schemas?.[name];
      if (!schema) {
        results.push(`Error: type "${name}" not found in ${packageName}`);
      } else {
        const options: FormatOptions = {
          format: outputFormat,
          full: args.flags.full,
          packageName,
          path: name,
        };
        results.push(format(schema, options));
      }
    }
    return results.join("\n\n");
  }

  if (!pkg.schemas) {
    throw new TypeNotFoundError(packageName, typeName);
  }

  const schema = pkg.schemas[typeName];
  if (!schema) {
    const typeNames = Object.keys(pkg.schemas);
    const similar = findSimilar(typeName, typeNames);
    const referencedIn = findMembersReferencingType(pkg.members, typeName);
    throw new TypeNotFoundError(packageName, typeName, similar, referencedIn);
  }

  const options: FormatOptions = {
    format: outputFormat,
    full: args.flags.full,
    packageName,
    path: typeName,
  };

  return format(schema, options);
}

function findMembersReferencingType(members: Member[], typeName: string, prefix = ''): string[] {
  const results: string[] = [];
  for (const member of members) {
    const path = prefix ? `${prefix}.${member.name}` : member.name;
    if (member.parameters?.some(p => p.type === typeName)) {
      results.push(path);
    }
    if (member.children) {
      results.push(...findMembersReferencingType(member.children, typeName, path));
    }
  }
  return results;
}
