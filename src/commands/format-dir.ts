/**
 * Format Directory Command
 *
 * Formats Package IR JSON to a markdown directory.
 * Usage: lrn format <file.json> --out <directory>
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ParsedArgs } from "../args.js";
import type { ResolvedConfig } from "../config.js";
import { ArgumentError } from "../errors.js";
import type {
  Package,
  Member,
  Guide,
  Section,
  Schema,
  Reference,
  Parameter,
  Example,
} from "../schema/index.js";

/**
 * Run the format command (to directory)
 */
export function runFormatDir(
  args: ParsedArgs,
  _config: ResolvedConfig
): string {
  const inputPath = args.positional[0];
  const outDir = args.options.out;

  if (!inputPath) {
    throw new ArgumentError(
      "Format requires a package JSON file.\n\nUsage: lrn format <file.json> --out <directory>"
    );
  }

  if (!outDir) {
    throw new ArgumentError(
      "Format to directory requires --out option.\n\nUsage: lrn format <file.json> --out <directory>"
    );
  }

  // Read and parse the package JSON
  const content = readFileSync(inputPath, "utf-8");
  const pkg = JSON.parse(content) as Package;

  // Create output directory structure
  formatPackageToDirectory(pkg, outDir);

  return `Formatted package to ${outDir}`;
}

/**
 * Format a Package to a markdown directory structure
 */
export function formatPackageToDirectory(pkg: Package, outDir: string): void {
  // Create base directory
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  // Write index.md
  const indexContent = formatPackageIndex(pkg);
  writeFileSync(join(outDir, "index.md"), indexContent);

  // Write members
  if (pkg.members.length > 0) {
    const membersDir = join(outDir, "members");
    mkdirSync(membersDir, { recursive: true });

    for (const member of pkg.members) {
      writeMemberFile(membersDir, member);
    }
  }

  // Write guides
  if (pkg.guides.length > 0) {
    const guidesDir = join(outDir, "guides");
    mkdirSync(guidesDir, { recursive: true });

    for (const guide of pkg.guides) {
      const guideContent = formatGuideFile(guide);
      writeFileSync(join(guidesDir, `${guide.slug}.md`), guideContent);
    }
  }

  // Write types/schemas
  if (Object.keys(pkg.schemas).length > 0) {
    const typesDir = join(outDir, "types");
    mkdirSync(typesDir, { recursive: true });

    for (const [name, schema] of Object.entries(pkg.schemas)) {
      const schemaContent = formatSchemaFile(name, schema);
      writeFileSync(join(typesDir, `${name}.md`), schemaContent);
    }
  }
}

/**
 * Format package index.md content
 */
function formatPackageIndex(pkg: Package): string {
  const lines: string[] = [];

  // Header with version
  const version = pkg.version ? ` v${pkg.version}` : "";
  lines.push(`# ${pkg.name}${version}`);
  lines.push("");

  // Summary as blockquote
  if (pkg.summary) {
    lines.push(`> ${pkg.summary}`);
    lines.push("");
  }

  // Source info
  if (pkg.source) {
    lines.push(`**Source:** ${pkg.source.type}`);
    if (pkg.source.baseUrl) {
      lines.push(`**BaseURL:** ${pkg.source.baseUrl}`);
    }
    if (pkg.source.url) {
      lines.push(`**URL:** ${pkg.source.url}`);
    }
    lines.push("");
  }

  // Description
  if (pkg.description) {
    lines.push(pkg.description);
    lines.push("");
  }

  // Tags
  if (pkg.tags && pkg.tags.length > 0) {
    lines.push(`**Tags:** ${pkg.tags.map((t) => `\`${t}\``).join(", ")}`);
    lines.push("");
  }

  // Links
  if (pkg.links) {
    lines.push("## Links");
    lines.push("");
    if (pkg.links.homepage) {
      lines.push(`- [Homepage](${pkg.links.homepage})`);
    }
    if (pkg.links.repository) {
      lines.push(`- [Repository](${pkg.links.repository})`);
    }
    if (pkg.links.documentation) {
      lines.push(`- [Documentation](${pkg.links.documentation})`);
    }
    if (pkg.links.changelog) {
      lines.push(`- [Changelog](${pkg.links.changelog})`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Write a member file, handling nested paths
 */
function writeMemberFile(baseDir: string, member: Member, parentPath: string = ""): void {
  const memberContent = formatMemberFile(member);

  // Build the full path including parent hierarchy
  // e.g., parent="Calculator", member.name="add" → "Calculator/add.md"
  const fullPath = parentPath ? `${parentPath}.${member.name}` : member.name;
  const pathParts = fullPath.split(".");
  const filename = pathParts.pop()! + ".md";
  const subDir = pathParts.length > 0 ? join(baseDir, ...pathParts) : baseDir;

  if (!existsSync(subDir)) {
    mkdirSync(subDir, { recursive: true });
  }

  writeFileSync(join(subDir, filename), memberContent);

  // Write children recursively with updated parent path
  if (member.children) {
    for (const child of member.children) {
      writeMemberFile(baseDir, child, fullPath);
    }
  }
}

/**
 * Format a Member to markdown file content
 */
export function formatMemberFile(member: Member): string {
  const lines: string[] = [];

  // Header
  const deprecated = member.deprecated !== undefined ? " ⚠️ DEPRECATED" : "";
  lines.push(`# ${member.name}${deprecated}`);
  lines.push("");

  // Kind
  lines.push(`**Kind:** ${member.kind}`);
  lines.push("");

  // Summary as blockquote
  if (member.summary) {
    lines.push(`> ${member.summary}`);
    lines.push("");
  }

  // HTTP endpoint
  if (member.http) {
    lines.push(`**Endpoint:** \`${member.http.method} ${member.http.path}\``);
    lines.push("");
  }

  // Tags
  if (member.tags && member.tags.length > 0) {
    lines.push(`**Tags:** ${member.tags.map((t) => `\`${t}\``).join(", ")}`);
    lines.push("");
  }

  // Since version
  if (member.since) {
    lines.push(`**Since:** ${member.since}`);
    lines.push("");
  }

  // Deprecation notice
  if (member.deprecated !== undefined) {
    lines.push(`> **Deprecated:** ${member.deprecated || "This member is deprecated."}`);
    lines.push("");
  }

  // Signature
  if (member.signature) {
    lines.push("```" + (member.signatureLanguage || "typescript"));
    lines.push(member.signature);
    lines.push("```");
    lines.push("");
  }

  // Description
  if (member.description) {
    lines.push(member.description);
    lines.push("");
  }

  // Parameters
  if (member.parameters && member.parameters.length > 0) {
    lines.push("## Parameters");
    lines.push("");
    lines.push(formatParameterTable(member.parameters));
    lines.push("");
  }

  // Returns
  if (member.returns) {
    lines.push("## Returns");
    lines.push("");
    if (member.returns.type) {
      lines.push(`**Type:** \`${member.returns.type}\``);
      lines.push("");
    }
    if (member.returns.description) {
      lines.push(member.returns.description);
      lines.push("");
    }
  }

  // Examples
  if (member.examples && member.examples.length > 0) {
    lines.push("## Examples");
    lines.push("");
    for (const example of member.examples) {
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
      lines.push("");
    }
  }

  // See Also
  if (member.see && member.see.length > 0) {
    lines.push("## See Also");
    lines.push("");
    for (const ref of member.see) {
      lines.push(`- ${formatReference(ref)}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Format a Guide to markdown file content
 */
export function formatGuideFile(guide: Guide): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${guide.title}`);
  lines.push("");

  // Type and level metadata
  lines.push(`**Type:** ${guide.kind}`);
  if (guide.level) {
    lines.push(`**Level:** ${guide.level}`);
  }
  lines.push("");

  // Summary as blockquote
  if (guide.summary) {
    lines.push(`> ${guide.summary}`);
    lines.push("");
  }

  // Tags
  if (guide.tags && guide.tags.length > 0) {
    lines.push(`**Tags:** ${guide.tags.map((t) => `\`${t}\``).join(", ")}`);
    lines.push("");
  }

  // Intro
  if (guide.intro) {
    lines.push(guide.intro);
    lines.push("");
  }

  // Sections
  for (const section of guide.sections) {
    lines.push(formatSectionContent(section, 2));
    lines.push("");
  }

  // See Also
  if (guide.see && guide.see.length > 0) {
    lines.push("## See Also");
    lines.push("");
    for (const ref of guide.see) {
      lines.push(`- ${formatReference(ref)}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Format a section and its nested sections
 */
function formatSectionContent(section: Section, depth: number): string {
  const lines: string[] = [];
  const heading = "#".repeat(depth);

  lines.push(`${heading} ${section.title}`);
  lines.push("");

  if (section.summary) {
    lines.push(`> ${section.summary}`);
    lines.push("");
  }

  if (section.content) {
    lines.push(section.content);
    lines.push("");
  }

  // Examples in section
  if (section.examples && section.examples.length > 0) {
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

  // Nested sections
  if (section.sections) {
    for (const sub of section.sections) {
      lines.push(formatSectionContent(sub, depth + 1));
    }
  }

  return lines.join("\n");
}

/**
 * Format a Schema to markdown file content
 */
export function formatSchemaFile(name: string, schema: Schema): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${name}`);
  lines.push("");

  // Type
  if (schema.type) {
    lines.push(`**Type:** \`${schema.type}\``);
    lines.push("");
  }

  // Description as blockquote
  if (schema.description) {
    lines.push(`> ${schema.description}`);
    lines.push("");
  }

  // Format
  if (schema.format) {
    lines.push(`**Format:** ${schema.format}`);
    lines.push("");
  }

  // Nullable
  if (schema.nullable) {
    lines.push(`**Nullable:** true`);
    lines.push("");
  }

  // Constraints
  if (schema.minimum !== undefined) {
    lines.push(`**Minimum:** ${schema.minimum}`);
  }
  if (schema.maximum !== undefined) {
    lines.push(`**Maximum:** ${schema.maximum}`);
  }
  if (schema.minLength !== undefined) {
    lines.push(`**MinLength:** ${schema.minLength}`);
  }
  if (schema.maxLength !== undefined) {
    lines.push(`**MaxLength:** ${schema.maxLength}`);
  }
  if (schema.pattern) {
    lines.push(`**Pattern:** \`${schema.pattern}\``);
  }
  if (
    schema.minimum !== undefined ||
    schema.maximum !== undefined ||
    schema.minLength !== undefined ||
    schema.maxLength !== undefined ||
    schema.pattern
  ) {
    lines.push("");
  }

  // Default
  if (schema.default !== undefined) {
    lines.push(`**Default:** ${JSON.stringify(schema.default)}`);
    lines.push("");
  }

  // Enum values
  if (schema.enum && schema.enum.length > 0) {
    lines.push("## Values");
    lines.push("");
    for (const value of schema.enum) {
      lines.push(`- \`${JSON.stringify(value)}\``);
    }
    lines.push("");
  }

  // Properties (for object types)
  if (schema.properties && Object.keys(schema.properties).length > 0) {
    lines.push("## Properties");
    lines.push("");
    lines.push("| Property | Type | Required | Description |");
    lines.push("|----------|------|----------|-------------|");
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      const required = schema.required?.includes(propName) ? "✓" : "";
      const propType = propSchema.type || propSchema.$ref || "any";
      const desc = propSchema.description || "";
      lines.push(`| \`${propName}\` | ${propType} | ${required} | ${desc} |`);
    }
    lines.push("");
  }

  // Array items
  if (schema.items) {
    lines.push("## Items");
    lines.push("");
    if (schema.items.$ref) {
      lines.push(`Array of \`${schema.items.$ref}\``);
    } else if (schema.items.type) {
      lines.push(`Array of \`${schema.items.type}\``);
    }
    lines.push("");
  }

  // Example
  if (schema.example !== undefined) {
    lines.push("## Example");
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(schema.example, null, 2));
    lines.push("```");
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Format parameter table
 */
function formatParameterTable(params: Parameter[]): string {
  const lines: string[] = [];

  // Check if any params have 'in' field (HTTP params)
  const hasIn = params.some((p) => p.in);

  if (hasIn) {
    lines.push("| Name | Type | In | Required | Description |");
    lines.push("|------|------|-----|----------|-------------|");
    for (const param of params) {
      const required = param.required ? "✓" : "";
      const type = param.type || "-";
      const inValue = param.in || "-";
      lines.push(
        `| \`${param.name}\` | ${type} | ${inValue} | ${required} | ${param.description || ""} |`
      );
    }
  } else {
    lines.push("| Name | Type | Required | Description |");
    lines.push("|------|------|----------|-------------|");
    for (const param of params) {
      const required = param.required ? "✓" : "";
      const type = param.type || "-";
      lines.push(
        `| \`${param.name}\` | ${type} | ${required} | ${param.description || ""} |`
      );
    }
  }

  return lines.join("\n");
}

/**
 * Format a reference as markdown link
 */
function formatReference(ref: Reference): string {
  const label = ref.label || ref.target;

  switch (ref.type) {
    case "url":
      return `[${label}](${ref.target})`;
    case "guide":
      return `[${label}](guides/${ref.target})`;
    case "schema":
      return `[${label}](types/${ref.target})`;
    case "member":
    default:
      return `[${label}](member:${ref.target})`;
  }
}
