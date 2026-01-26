/**
 * Markdown Formatter
 *
 * Markdown output for documentation and chat.
 */

import type { Package, Member, Guide, Section, Schema } from "../schema/index.js";
import type { FormattableData, FormatOptions, SearchResults, TagList } from "./index.js";

/**
 * Format data as Markdown
 */
export function formatMarkdown(data: FormattableData, options: FormatOptions): string {
  if (Array.isArray(data)) {
    if (data.length === 0) return "*No items found.*";

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
    return formatMember(data as Member, options);
  }

  if ("slug" in data && "sections" in data) {
    return formatGuide(data as Guide, options);
  }

  if ("id" in data && "content" in data) {
    return formatSection(data as Section, options);
  }

  if ("type" in data || "properties" in data || "$ref" in data) {
    return formatSchema(data as Schema, options);
  }

  return "```json\n" + JSON.stringify(data, null, 2) + "\n```";
}

function formatPackageList(packages: Package[]): string {
  const lines: string[] = ["# Packages", ""];

  for (const pkg of packages) {
    const version = pkg.version ? ` \`${pkg.version}\`` : "";
    lines.push(`- **${pkg.name}**${version} - ${pkg.summary || ""}`);
  }

  return lines.join("\n");
}

function formatPackage(pkg: Package, options: FormatOptions): string {
  const lines: string[] = [];

  // Header
  const version = pkg.version ? ` v${pkg.version}` : "";
  lines.push(`# ${pkg.name}${version}`);
  lines.push("");

  if (pkg.summary) {
    lines.push(`> ${pkg.summary}`);
    lines.push("");
  }

  if (pkg.description) {
    lines.push(pkg.description);
    lines.push("");
  }

  // Members
  if (pkg.members.length > 0) {
    lines.push("## Members");
    lines.push("");
    const shown = options.full ? pkg.members : pkg.members.slice(0, 10);
    for (const member of shown) {
      lines.push(`- \`${member.name}\` - ${member.summary || member.kind}`);
    }
    if (!options.full && pkg.members.length > 10) {
      lines.push(`- *... and ${pkg.members.length - 10} more*`);
    }
    lines.push("");
  }

  // Guides
  if (pkg.guides.length > 0) {
    lines.push("## Guides");
    lines.push("");
    for (const guide of pkg.guides) {
      lines.push(`- **${guide.title}** (\`${guide.slug}\`) - ${guide.summary || ""}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function formatMemberList(members: Member[], options: FormatOptions): string {
  const lines: string[] = ["# Members", ""];

  lines.push("| Name | Kind | Summary |");
  lines.push("|------|------|---------|");

  function addMember(member: Member, path: string): void {
    const fullPath = path ? `${path}.${member.name}` : member.name;
    const deprecated = member.deprecated ? " ⚠️" : "";
    lines.push(`| \`${fullPath}\`${deprecated} | ${member.kind} | ${member.summary || ""} |`);

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

function formatMember(member: Member, options: FormatOptions): string {
  const lines: string[] = [];

  // Header
  const deprecated = member.deprecated ? " ⚠️ DEPRECATED" : "";
  lines.push(`# ${member.name}${deprecated}`);
  lines.push("");

  lines.push(`**Kind:** ${member.kind}`);

  if (member.summary) {
    lines.push("");
    lines.push(`> ${member.summary}`);
  }

  // HTTP info
  if (member.http) {
    lines.push("");
    lines.push(`**Endpoint:** \`${member.http.method} ${member.http.path}\``);
  }

  // Signature
  if (member.signature) {
    lines.push("");
    lines.push("```typescript");
    lines.push(member.signature);
    lines.push("```");
  }

  // Description
  if (member.description) {
    lines.push("");
    lines.push(member.description);
  }

  // Parameters
  if (member.parameters && member.parameters.length > 0) {
    lines.push("");
    lines.push("## Parameters");
    lines.push("");
    lines.push("| Name | Type | Required | Description |");
    lines.push("|------|------|----------|-------------|");
    for (const param of member.parameters) {
      const required = param.required ? "✓" : "";
      const type = param.type || "-";
      lines.push(`| \`${param.name}\` | ${type} | ${required} | ${param.description || ""} |`);
    }
  }

  // Returns
  if (member.returns) {
    lines.push("");
    lines.push("## Returns");
    lines.push("");
    lines.push(`**Type:** \`${member.returns.type || "void"}\``);
    if (member.returns.description) {
      lines.push("");
      lines.push(member.returns.description);
    }
  }

  // Examples
  if (member.examples && member.examples.length > 0) {
    lines.push("");
    lines.push("## Examples");
    for (const example of member.examples) {
      lines.push("");
      if (example.title) {
        lines.push(`### ${example.title}`);
        lines.push("");
      }
      if (example.description) {
        lines.push(example.description);
        lines.push("");
      }
      lines.push("```" + (example.language || ""));
      lines.push(example.code);
      lines.push("```");
    }
  }

  // Tags
  if (member.tags && member.tags.length > 0) {
    lines.push("");
    lines.push(`**Tags:** ${member.tags.map((t) => `\`${t}\``).join(", ")}`);
  }

  // Deprecation
  if (member.deprecated) {
    lines.push("");
    lines.push(`> ⚠️ **Deprecated:** ${member.deprecated}`);
  }

  return lines.join("\n");
}

function formatGuideList(guides: Guide[]): string {
  const lines: string[] = ["# Guides", ""];

  for (const guide of guides) {
    const level = guide.level ? ` (${guide.level})` : "";
    lines.push(`- **${guide.title}** - \`${guide.slug}\`${level}`);
    if (guide.summary) {
      lines.push(`  ${guide.summary}`);
    }
  }

  return lines.join("\n");
}

function formatGuide(guide: Guide, options: FormatOptions): string {
  const lines: string[] = [];

  lines.push(`# ${guide.title}`);
  lines.push("");

  if (guide.summary) {
    lines.push(`> ${guide.summary}`);
    lines.push("");
  }

  lines.push(`**Type:** ${guide.kind}`);
  if (guide.level) {
    lines.push(`**Level:** ${guide.level}`);
  }
  lines.push("");

  if (guide.intro) {
    lines.push(guide.intro);
    lines.push("");
  }

  if (options.full) {
    for (const section of guide.sections) {
      lines.push(formatSection(section, options));
      lines.push("");
    }
  } else {
    lines.push("## Contents");
    lines.push("");
    for (const section of guide.sections) {
      lines.push(`- **${section.title}** - ${section.summary || ""}`);
    }
  }

  return lines.join("\n");
}

function formatSection(section: Section, options: FormatOptions): string {
  const lines: string[] = [];

  lines.push(`## ${section.title}`);
  lines.push("");

  if (section.content) {
    lines.push(section.content);
    lines.push("");
  }

  if (section.examples) {
    for (const example of section.examples) {
      if (example.title) {
        lines.push(`**${example.title}:**`);
        lines.push("");
      }
      lines.push("```" + (example.language || ""));
      lines.push(example.code);
      lines.push("```");
      lines.push("");
    }
  }

  if (section.sections && options.full) {
    for (const sub of section.sections) {
      lines.push(formatSection(sub, options));
    }
  }

  return lines.join("\n");
}

function formatSchema(schema: Schema, _options: FormatOptions): string {
  const lines: string[] = [];

  if (schema.$ref) {
    return `*Reference to* \`${schema.$ref}\``;
  }

  const type = schema.type || "any";
  lines.push(`**Type:** \`${type}\`${schema.nullable ? " | null" : ""}`);

  if (schema.description) {
    lines.push("");
    lines.push(schema.description);
  }

  if (schema.properties) {
    lines.push("");
    lines.push("| Property | Type | Required | Description |");
    lines.push("|----------|------|----------|-------------|");
    for (const [name, prop] of Object.entries(schema.properties)) {
      const required = schema.required?.includes(name) ? "✓" : "";
      const propType = prop.type || prop.$ref || "any";
      lines.push(`| \`${name}\` | ${propType} | ${required} | ${prop.description || ""} |`);
    }
  }

  return lines.join("\n");
}

function formatSearchResults(results: SearchResults): string {
  const lines: string[] = [];

  lines.push(`# Search: "${results.query}"`);
  lines.push("");

  if (results.results.length === 0) {
    lines.push("*No results found.*");
    return lines.join("\n");
  }

  for (const result of results.results) {
    const type = result.type === "guide" ? " 📖" : "";
    lines.push(`- **${result.package}**.${result.path}${type}`);
    if (result.summary) {
      lines.push(`  ${result.summary}`);
    }
  }

  return lines.join("\n");
}

function formatTagList(tagList: TagList): string {
  const lines: string[] = ["# Tags", ""];

  for (const { name, count } of tagList.tags) {
    lines.push(`- \`${name}\` (${count})`);
  }

  return lines.join("\n");
}
