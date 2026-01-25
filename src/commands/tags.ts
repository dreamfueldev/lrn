/**
 * Tags Command
 *
 * `lrn <package> tags` - lists all tags used in a package with counts
 */

import type { Member, Guide } from "../schema/index.js";
import type { ParsedArgs } from "../args.js";
import type { ResolvedConfig } from "../config.js";
import { loadPackage } from "../cache.js";
import { format, getOutputFormat, type FormatOptions, type TagList } from "../format/index.js";

export function runTags(args: ParsedArgs, config: ResolvedConfig): void {
  const packageName = args.package!;
  const version = args.packageVersion;

  const pkg = loadPackage(config, packageName, version);

  // Collect all tags from members and guides
  const tagCounts = new Map<string, number>();

  function collectMemberTags(members: Member[]): void {
    for (const member of members) {
      if (member.tags) {
        for (const tag of member.tags) {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
      }
      if (member.children) {
        collectMemberTags(member.children);
      }
    }
  }

  function collectGuideTags(guides: Guide[]): void {
    for (const guide of guides) {
      if (guide.tags) {
        for (const tag of guide.tags) {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
      }
    }
  }

  collectMemberTags(pkg.members);
  collectGuideTags(pkg.guides);

  if (tagCounts.size === 0) {
    console.log("No tags found.");
    return;
  }

  // Sort by count descending, then alphabetically
  const sortedTags = Array.from(tagCounts.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .map(([name, count]) => ({ name, count }));

  const tagList: TagList = {
    kind: "tag-list",
    tags: sortedTags,
  };

  const outputFormat = getOutputFormat(args, config);
  const options: FormatOptions = {
    format: outputFormat,
    full: args.flags.full,
    packageName,
  };

  console.log(format(tagList, options));
}
