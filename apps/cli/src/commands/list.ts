/**
 * List Command
 *
 * `lrn <package> list` - lists members of a package
 * `lrn <package> list --deep` - lists members recursively
 */

import type { Member } from "../schema/index.js";
import type { ParsedArgs } from "../args.js";
import type { ResolvedConfig } from "../config.js";
import { loadPackage } from "../cache.js";
import { format, getOutputFormat, type FormatOptions } from "../format/index.js";

export function runList(args: ParsedArgs, config: ResolvedConfig): void {
  const packageName = args.package!;
  const version = args.packageVersion;

  const pkg = loadPackage(config, packageName, version);

  let members = pkg.members;

  // Apply filters
  members = applyFilters(members, args);

  const outputFormat = getOutputFormat(args, config);
  const options: FormatOptions = {
    format: outputFormat,
    full: args.flags.deep || args.flags.full,
    packageName,
  };

  console.log(format(members, options));
}

function applyFilters(members: Member[], args: ParsedArgs): Member[] {
  let filtered = members;

  // Filter by kind
  if (args.options.kind) {
    const kind = args.options.kind;
    filtered = filterByKind(filtered, kind);
  }

  // Filter by tags
  if (args.options.tag && args.options.tag.length > 0) {
    filtered = filterByTags(filtered, args.options.tag);
  }

  // Filter deprecated
  if (!args.flags.deprecated) {
    // By default, hide deprecated unless --deprecated is set
    // Actually, show all by default, --deprecated filters TO deprecated only
  }

  if (args.flags.deprecated) {
    filtered = filterDeprecated(filtered);
  }

  return filtered;
}

function filterByKind(members: Member[], kind: string): Member[] {
  const result: Member[] = [];

  for (const member of members) {
    if (member.kind === kind) {
      result.push(member);
    } else if (member.children) {
      const filteredChildren = filterByKind(member.children, kind);
      if (filteredChildren.length > 0) {
        result.push(...filteredChildren);
      }
    }
  }

  return result;
}

function filterByTags(members: Member[], tags: string[]): Member[] {
  const result: Member[] = [];

  for (const member of members) {
    const hasMatchingTag = member.tags?.some((t) => tags.includes(t));
    if (hasMatchingTag) {
      result.push(member);
    }
    if (member.children) {
      const filteredChildren = filterByTags(member.children, tags);
      result.push(...filteredChildren);
    }
  }

  return result;
}

function filterDeprecated(members: Member[]): Member[] {
  const result: Member[] = [];

  for (const member of members) {
    if (member.deprecated) {
      result.push(member);
    }
    if (member.children) {
      const filteredChildren = filterDeprecated(member.children);
      result.push(...filteredChildren);
    }
  }

  return result;
}
