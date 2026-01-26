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

export function runMember(args: ParsedArgs, config: ResolvedConfig): void {
  const packageName = args.package!;
  const version = args.packageVersion;
  const memberPath = args.positional[0];

  if (!memberPath) {
    throw new MemberNotFoundError(packageName, "");
  }

  const pkg = loadPackage(config, packageName, version);

  const member = resolveMemberPath(pkg.members, memberPath);

  if (!member) {
    // Try to find similar member names for suggestion
    const allPaths = getAllMemberPaths(pkg.members);
    const similar = findSimilar(memberPath, allPaths);
    throw new MemberNotFoundError(packageName, memberPath, similar);
  }

  const outputFormat = getOutputFormat(args, config);
  const options: FormatOptions = {
    format: outputFormat,
    full: args.flags.full,
    packageName,
    path: memberPath,
  };

  console.log(format(member, options));
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
