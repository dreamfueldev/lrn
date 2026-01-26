/**
 * Text Formatter
 *
 * Human-readable text output with indentation and structure.
 */

import type { Package, Member, Guide, Section, Schema, Example } from "../schema/index.js";
import type { FormattableData, FormatOptions, SearchResults, TagList } from "./index.js";

/**
 * Format data as human-readable text
 */
export function formatText(data: FormattableData, options: FormatOptions): string {
  if (Array.isArray(data)) {
    if (data.length === 0) return "No items found.";

    // Check first item to determine type
    const first = data[0]!;
    if ("members" in first) {
      // Package[]
      return formatPackageList(data as Package[]);
    }
    if ("kind" in first && "name" in first) {
      // Member[]
      return formatMemberList(data as Member[], options);
    }
    if ("slug" in first) {
      // Guide[]
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
    // Package
    return formatPackage(data as Package, options);
  }

  if ("kind" in data && "name" in data && !("slug" in data)) {
    // Member
    return formatMember(data as Member, options);
  }

  if ("slug" in data && "sections" in data) {
    // Guide
    return formatGuide(data as Guide, options);
  }

  if ("id" in data && "content" in data) {
    // Section
    return formatSection(data as Section, options);
  }

  if ("type" in data || "properties" in data || "$ref" in data) {
    // Schema
    return formatSchema(data as Schema, options);
  }

  return JSON.stringify(data, null, 2);
}

function formatPackageList(packages: Package[]): string {
  const lines: string[] = [];

  for (const pkg of packages) {
    const version = pkg.version ? `@${pkg.version}` : "";
    const summary = pkg.summary ? `  ${pkg.summary}` : "";
    lines.push(`${pkg.name}${version}${summary}`);
  }

  return lines.join("\n");
}

function formatPackage(pkg: Package, options: FormatOptions): string {
  const lines: string[] = [];

  // Header
  const version = pkg.version ? ` v${pkg.version}` : "";
  lines.push(`${pkg.name}${version}`);

  if (pkg.summary) {
    lines.push(pkg.summary);
  }

  if (pkg.description && options.full) {
    lines.push("");
    lines.push(pkg.description);
  }

  // Source info
  if (pkg.source?.baseUrl) {
    lines.push("");
    lines.push(`Base URL: ${pkg.source.baseUrl}`);
  }

  // Members summary
  if (pkg.members.length > 0) {
    lines.push("");
    lines.push(`Members (${pkg.members.length}):`);
    const shown = options.full ? pkg.members : pkg.members.slice(0, 10);
    for (const member of shown) {
      const summary = member.summary ? `  ${member.summary}` : "";
      lines.push(`  ${member.name}${summary}`);
    }
    if (!options.full && pkg.members.length > 10) {
      lines.push(`  ... and ${pkg.members.length - 10} more`);
    }
  }

  // Guides summary
  if (pkg.guides.length > 0) {
    lines.push("");
    lines.push(`Guides (${pkg.guides.length}):`);
    for (const guide of pkg.guides) {
      const summary = guide.summary ? `  ${guide.summary}` : "";
      lines.push(`  ${guide.slug}${summary}`);
    }
  }

  // Links
  if (pkg.links && options.full) {
    lines.push("");
    lines.push("Links:");
    if (pkg.links.homepage) lines.push(`  Homepage: ${pkg.links.homepage}`);
    if (pkg.links.repository) lines.push(`  Repository: ${pkg.links.repository}`);
    if (pkg.links.documentation) lines.push(`  Documentation: ${pkg.links.documentation}`);
  }

  return lines.join("\n");
}

function formatMemberList(members: Member[], options: FormatOptions): string {
  const lines: string[] = [];

  function formatMemberLine(member: Member, indent: string, path: string): void {
    const fullPath = path ? `${path}.${member.name}` : member.name;
    const kind = `[${member.kind}]`;
    const summary = member.summary ? `  ${member.summary}` : "";
    const deprecated = member.deprecated ? " (deprecated)" : "";
    lines.push(`${indent}${fullPath} ${kind}${deprecated}${summary}`);

    if (options.full && member.children) {
      for (const child of member.children) {
        formatMemberLine(child, indent + "  ", fullPath);
      }
    }
  }

  for (const member of members) {
    formatMemberLine(member, "", "");
  }

  return lines.join("\n");
}

function formatMember(member: Member, options: FormatOptions): string {
  const lines: string[] = [];

  // Header
  const kind = `[${member.kind}]`;
  const deprecated = member.deprecated ? " (deprecated)" : "";
  lines.push(`${member.name} ${kind}${deprecated}`);

  if (member.summary) {
    lines.push(member.summary);
  }

  // HTTP info
  if (member.http) {
    lines.push("");
    lines.push(`${member.http.method} ${member.http.path}`);
  }

  // Signature
  if (member.signature) {
    lines.push("");
    lines.push(`Signature: ${member.signature}`);
  }

  // Description
  if (member.description) {
    lines.push("");
    lines.push(member.description);
  }

  // Parameters
  if (member.parameters && member.parameters.length > 0) {
    lines.push("");
    lines.push("Parameters:");
    for (const param of member.parameters) {
      const required = param.required ? " (required)" : "";
      const type = param.type ? `: ${param.type}` : "";
      const defaultVal = param.default !== undefined ? ` = ${JSON.stringify(param.default)}` : "";
      const desc = param.description ? `  ${param.description}` : "";
      lines.push(`  ${param.name}${type}${required}${defaultVal}${desc}`);
    }
  }

  // Returns
  if (member.returns) {
    lines.push("");
    lines.push(`Returns: ${member.returns.type || "void"}`);
    if (member.returns.description) {
      lines.push(`  ${member.returns.description}`);
    }
  }

  // Examples
  if (member.examples && member.examples.length > 0) {
    lines.push("");
    lines.push("Examples:");
    for (const example of member.examples) {
      if (example.title) {
        lines.push("");
        lines.push(`  ${example.title}:`);
      }
      lines.push("");
      const codeLines = example.code.split("\n");
      for (const line of codeLines) {
        lines.push(`    ${line}`);
      }
    }
  }

  // Tags
  if (member.tags && member.tags.length > 0) {
    lines.push("");
    lines.push(`Tags: ${member.tags.join(", ")}`);
  }

  // Children
  if (member.children && member.children.length > 0) {
    lines.push("");
    lines.push("Members:");
    for (const child of member.children) {
      const summary = child.summary ? `  ${child.summary}` : "";
      lines.push(`  ${child.name} [${child.kind}]${summary}`);
    }
  }

  // See also
  if (member.see && member.see.length > 0) {
    lines.push("");
    lines.push("See also:");
    for (const ref of member.see) {
      const label = ref.label || ref.target;
      lines.push(`  → ${label} (${ref.type})`);
    }
  }

  // Deprecation notice
  if (member.deprecated) {
    lines.push("");
    lines.push(`Deprecated: ${member.deprecated}`);
  }

  return lines.join("\n");
}

function formatGuideList(guides: Guide[]): string {
  const lines: string[] = [];

  for (const guide of guides) {
    const level = guide.level ? ` [${guide.level}]` : "";
    const summary = guide.summary ? `  ${guide.summary}` : "";
    lines.push(`${guide.slug} (${guide.kind})${level}${summary}`);
  }

  return lines.join("\n");
}

function formatGuide(guide: Guide, options: FormatOptions): string {
  const lines: string[] = [];

  // Header
  lines.push(guide.title);
  if (guide.summary) {
    lines.push(guide.summary);
  }

  lines.push("");
  lines.push(`Type: ${guide.kind}`);
  if (guide.level) {
    lines.push(`Level: ${guide.level}`);
  }

  // Intro
  if (guide.intro) {
    lines.push("");
    lines.push(guide.intro);
  }

  // Sections
  if (guide.sections.length > 0) {
    lines.push("");
    if (options.full) {
      // Show full content
      for (const section of guide.sections) {
        lines.push("");
        lines.push(formatSection(section, options));
      }
    } else {
      // Show TOC
      lines.push("Sections:");
      for (const section of guide.sections) {
        const summary = section.summary ? `  ${section.summary}` : "";
        lines.push(`  ${section.id}: ${section.title}${summary}`);
        if (section.sections) {
          for (const sub of section.sections) {
            lines.push(`    ${section.id}.${sub.id}: ${sub.title}`);
          }
        }
      }
    }
  }

  // Tags
  if (guide.tags && guide.tags.length > 0) {
    lines.push("");
    lines.push(`Tags: ${guide.tags.join(", ")}`);
  }

  // See also
  if (guide.see && guide.see.length > 0) {
    lines.push("");
    lines.push("See also:");
    for (const ref of guide.see) {
      const label = ref.label || ref.target;
      lines.push(`  → ${label} (${ref.type})`);
    }
  }

  return lines.join("\n");
}

function formatSection(section: Section, options: FormatOptions): string {
  const lines: string[] = [];

  lines.push(`## ${section.title}`);

  if (section.summary && !options.full) {
    lines.push(section.summary);
  }

  if (section.content) {
    lines.push("");
    lines.push(section.content);
  }

  // Examples
  if (section.examples && section.examples.length > 0) {
    for (const example of section.examples) {
      if (example.title) {
        lines.push("");
        lines.push(`**${example.title}:**`);
      }
      lines.push("");
      lines.push("```" + (example.language || ""));
      lines.push(example.code);
      lines.push("```");
    }
  }

  // Subsections
  if (section.sections && options.full) {
    for (const sub of section.sections) {
      lines.push("");
      lines.push(formatSection(sub, options));
    }
  }

  return lines.join("\n");
}

function formatSchema(schema: Schema, options: FormatOptions): string {
  const lines: string[] = [];

  if (schema.$ref) {
    lines.push(`Reference: ${schema.$ref}`);
    return lines.join("\n");
  }

  const type = schema.type || "any";
  lines.push(`Type: ${type}${schema.nullable ? " | null" : ""}`);

  if (schema.description) {
    lines.push(schema.description);
  }

  if (schema.format) {
    lines.push(`Format: ${schema.format}`);
  }

  if (schema.enum) {
    lines.push(`Enum: ${schema.enum.map((v) => JSON.stringify(v)).join(" | ")}`);
  }

  if (schema.properties) {
    lines.push("");
    lines.push("Properties:");
    for (const [name, prop] of Object.entries(schema.properties)) {
      const required = schema.required?.includes(name) ? " (required)" : "";
      const propType = prop.type || prop.$ref || "any";
      const desc = prop.description ? `  ${prop.description}` : "";
      lines.push(`  ${name}: ${propType}${required}${desc}`);
    }
  }

  if (schema.items) {
    lines.push("");
    lines.push("Items:");
    lines.push("  " + formatSchema(schema.items, options).split("\n").join("\n  "));
  }

  return lines.join("\n");
}

function formatSearchResults(results: SearchResults): string {
  const lines: string[] = [];

  lines.push(`Search results for "${results.query}":`);
  lines.push("");

  if (results.results.length === 0) {
    lines.push("No results found.");
    return lines.join("\n");
  }

  for (const result of results.results) {
    const type = result.type === "member" ? "" : " (guide)";
    const summary = result.summary ? `  ${result.summary}` : "";
    lines.push(`${result.package}.${result.path}${type}${summary}`);
  }

  return lines.join("\n");
}

function formatTagList(tagList: TagList): string {
  const lines: string[] = [];

  for (const { name, count } of tagList.tags) {
    lines.push(`${name} (${count})`);
  }

  return lines.join("\n");
}
