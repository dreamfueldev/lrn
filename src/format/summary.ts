/**
 * Summary Formatter
 *
 * Minimal output - names/paths only, one per line.
 * Designed for piping to other commands.
 */

import type { Package, Member, Guide, Section, Schema } from "../schema/index.js";
import type { FormattableData, FormatOptions, SearchResults, TagList } from "./index.js";

/**
 * Format data as minimal summary (names only)
 */
export function formatSummary(data: FormattableData, options: FormatOptions): string {
  if (Array.isArray(data)) {
    if (data.length === 0) return "";

    const first = data[0]!;
    if ("members" in first) {
      return formatPackageList(data as Package[]);
    }
    if ("kind" in first && "name" in first) {
      return formatMemberList(data as Member[], options);
    }
    if ("slug" in first) {
      return formatGuideList(data as Guide[]);
    }
  }

  if ("kind" in data && data.kind === "search-results") {
    return formatSearchResults(data as SearchResults);
  }

  if ("kind" in data && data.kind === "tag-list") {
    return formatTagList(data as TagList);
  }

  if ("members" in data && "guides" in data) {
    return formatPackage(data as Package, options);
  }

  if ("kind" in data && "name" in data && !("slug" in data)) {
    return formatMember(data as Member);
  }

  if ("slug" in data && "sections" in data) {
    return formatGuide(data as Guide, options);
  }

  if ("id" in data && "content" in data) {
    return formatSection(data as Section);
  }

  if ("type" in data || "properties" in data || "$ref" in data) {
    return formatSchema(data as Schema);
  }

  return "";
}

function formatPackageList(packages: Package[]): string {
  return packages.map((p) => p.name).join("\n");
}

function formatPackage(pkg: Package, options: FormatOptions): string {
  const lines: string[] = [];

  // Members
  const members = options.full ? pkg.members : pkg.members.slice(0, 10);
  for (const member of members) {
    lines.push(member.name);
  }

  // Guides
  for (const guide of pkg.guides) {
    lines.push(`guide:${guide.slug}`);
  }

  return lines.join("\n");
}

function formatMemberList(members: Member[], options: FormatOptions): string {
  const lines: string[] = [];

  function addMember(member: Member, path: string): void {
    const fullPath = path ? `${path}.${member.name}` : member.name;
    lines.push(fullPath);

    if (options.full && member.children) {
      for (const child of member.children) {
        addMember(child, fullPath);
      }
    }
  }

  for (const member of members) {
    addMember(member, "");
  }

  return lines.join("\n");
}

function formatMember(member: Member): string {
  return member.name;
}

function formatGuideList(guides: Guide[]): string {
  return guides.map((g) => g.slug).join("\n");
}

function formatGuide(guide: Guide, options: FormatOptions): string {
  const lines: string[] = [];

  function addSection(section: Section, path: string): void {
    const fullPath = path ? `${path}.${section.id}` : section.id;
    lines.push(fullPath);

    if (options.full && section.sections) {
      for (const sub of section.sections) {
        addSection(sub, fullPath);
      }
    }
  }

  for (const section of guide.sections) {
    addSection(section, "");
  }

  return lines.join("\n");
}

function formatSection(section: Section): string {
  return section.id;
}

function formatSchema(schema: Schema): string {
  if (schema.$ref) {
    return schema.$ref;
  }
  return schema.type || "any";
}

function formatSearchResults(results: SearchResults): string {
  return results.results.map((r) => `${r.package}.${r.path}`).join("\n");
}

function formatTagList(tagList: TagList): string {
  return tagList.tags.map((t) => t.name).join("\n");
}
