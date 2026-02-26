/**
 * Member Command
 *
 * `lrn <package> <member.path>` - shows member details
 */

import type { Member } from "../schema/index.js";
import type { ParsedArgs } from "../args.js";
import type { ResolvedConfig } from "../config.js";
import { loadPackage } from "../cache.js";
import { MemberNotFoundError, findSimilar } from "../errors.js";
import { format, getOutputFormat, type FormatOptions } from "../format/index.js";

export function runMember(args: ParsedArgs, config: ResolvedConfig): string {
  const packageName = args.package!;
  const version = args.packageVersion;
  const memberPath = args.positional.join(".");

  if (!memberPath) {
    throw new MemberNotFoundError(packageName, "");
  }

  const pkg = loadPackage(config, packageName, version);
  const outputFormat = getOutputFormat(args, config);

  // Multi-member query: comma-separated paths
  if (memberPath.includes(",")) {
    const paths = memberPath.split(",").map(p => p.trim()).filter(Boolean);
    const multiExtraction = args.flags.signature
      ? "signature" as const
      : args.flags.examples
        ? "examples" as const
        : args.flags.parameters
          ? "parameters" as const
          : undefined;

    const results: string[] = [];
    for (const p of paths) {
      const member = resolveMemberPath(pkg.members, p);
      if (!member) {
        results.push(`Error: member "${p}" not found in ${packageName}`);
      } else {
        const options: FormatOptions = {
          format: outputFormat,
          full: args.flags.full,
          packageName,
          path: p,
          extraction: multiExtraction,
        };
        results.push(format(member, options));
      }
    }
    return results.join("\n\n");
  }

  const member = resolveMemberPath(pkg.members, memberPath);

  if (!member) {
    const allPaths = getAllMemberPaths(pkg.members);
    const similar = findSimilar(memberPath, allPaths);
    throw new MemberNotFoundError(packageName, memberPath, similar);
  }

  const extraction = args.flags.signature
    ? "signature" as const
    : args.flags.examples
      ? "examples" as const
      : args.flags.parameters
        ? "parameters" as const
        : undefined;

  const options: FormatOptions = {
    format: outputFormat,
    full: args.flags.full,
    packageName,
    path: memberPath,
    extraction,
  };

  return format(member, options);
}

function resolveMemberPath(members: Member[], path: string): Member | undefined {
  const parts = path.split(".");
  let current: Member[] = members;
  let found: Member | undefined;

  for (const part of parts) {
    found = current.find((m) => m.name === part);
    if (!found) {
      return undefined;
    }
    current = found.children || [];
  }

  return found;
}

function getAllMemberPaths(members: Member[], prefix = ""): string[] {
  const paths: string[] = [];

  for (const member of members) {
    const path = prefix ? `${prefix}.${member.name}` : member.name;
    paths.push(path);

    if (member.children) {
      paths.push(...getAllMemberPaths(member.children, path));
    }
  }

  return paths;
}
