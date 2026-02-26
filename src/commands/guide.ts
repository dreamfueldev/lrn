/**
 * Guide Command
 *
 * `lrn <package> guide <slug>` - shows guide overview/TOC
 * `lrn <package> guide <slug> --full` - shows full guide content
 * `lrn <package> guide <slug>.<section>` - shows specific section
 */

import type { Guide, Section } from "../schema/index.js";
import type { ParsedArgs } from "../args.js";
import type { ResolvedConfig } from "../config.js";
import { loadPackage } from "../cache.js";
import { GuideNotFoundError, SectionNotFoundError, findSimilar } from "../errors.js";
import { format, getOutputFormat, type FormatOptions } from "../format/index.js";

export function runGuide(args: ParsedArgs, config: ResolvedConfig): string {
  const packageName = args.package!;
  const version = args.packageVersion;
  const slugPath = args.positional[0];

  if (!slugPath) {
    throw new GuideNotFoundError(packageName, "");
  }

  const pkg = loadPackage(config, packageName, version);

  // Parse slug.section.subsection path
  const parts = slugPath.split(".");
  const slug = parts[0]!;
  const sectionPath = parts.slice(1);

  // Find the guide
  const guide = pkg.guides.find((g) => g.slug === slug);
  if (!guide) {
    const slugs = pkg.guides.map((g) => g.slug);
    const similar = findSimilar(slug, slugs);
    throw new GuideNotFoundError(packageName, slug, similar);
  }

  const outputFormat = getOutputFormat(args, config);
  const options: FormatOptions = {
    format: outputFormat,
    full: args.flags.full,
    packageName,
    path: slugPath,
  };

  // If section path provided, resolve to specific section
  if (sectionPath.length > 0) {
    const section = resolveSectionPath(guide.sections, sectionPath);
    if (!section) {
      const allSectionIds = getAllSectionIds(guide.sections);
      const fullPath = sectionPath.join(".");
      const similar = findSimilar(fullPath, allSectionIds);
      throw new SectionNotFoundError(packageName, slug, fullPath, similar);
    }
    return format(section, options);
  } else {
    return format(guide, options);
  }
}

function resolveSectionPath(sections: Section[], path: string[]): Section | undefined {
  let current: Section[] = sections;
  let found: Section | undefined;

  for (const id of path) {
    found = current.find((s) => s.id === id);
    if (!found) {
      return undefined;
    }
    current = found.sections || [];
  }

  return found;
}

function getAllSectionIds(sections: Section[], prefix = ""): string[] {
  const ids: string[] = [];

  for (const section of sections) {
    const path = prefix ? `${prefix}.${section.id}` : section.id;
    ids.push(path);

    if (section.sections) {
      ids.push(...getAllSectionIds(section.sections, path));
    }
  }

  return ids;
}
