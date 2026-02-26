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

  if ("type" in data || "properties" in data || "$ref" in data || "oneOf" in data || "allOf" in data) {
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
    for (const member of pkg.members) {
      const summary = member.summary ? `  ${member.summary}` : "";
      lines.push(`  ${member.name}${summary}`);
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
    const detail = options.signatures && member.signature
      ? `  ${member.signature}`
      : (member.summary ? `  ${member.summary}` : "");
    const deprecated = member.deprecated ? " (deprecated)" : "";
    lines.push(`${indent}${fullPath} ${kind}${deprecated}${detail}`);

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
  // Extraction flags: return only the requested part
  if (options.extraction === "signature") {
    return member.signature || "No signature available.";
  }
  if (options.extraction === "examples") {
    return formatExamplesExtraction(member.examples);
  }
  if (options.extraction === "parameters") {
    return formatParametersExtraction(member.parameters);
  }

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

    // Path parameters
    const pathParams = member.parameters?.filter(p => p.in === "path");
    if (pathParams && pathParams.length > 0) {
      lines.push("");
      lines.push("Path Parameters:");
      for (const param of pathParams) {
        const required = param.required ? " (required)" : "";
        const type = param.type || "string";
        const desc = param.description ? `  ${param.description}` : "";
        lines.push(`  {${param.name}}  ${type}${desc}${required}`);
      }
    }

    // Query parameters
    if (member.http.query && member.http.query.length > 0) {
      lines.push("");
      lines.push("Query Parameters:");
      for (const param of member.http.query) {
        const type = param.type || "string";
        const desc = param.description ? `  ${param.description}` : "";
        const defaultVal = param.default !== undefined ? `  (default: ${JSON.stringify(param.default)})` : "";
        lines.push(`  ${param.name}  ${type}${desc}${defaultVal}`);
      }
    }

    // Responses
    if (member.http.responses) {
      lines.push("");
      lines.push("Responses:");
      for (const [status, response] of Object.entries(member.http.responses)) {
        const schema = typeof response.schema === "string" ? ` → ${response.schema}` : "";
        lines.push(`  ${status}  ${response.description}${schema}`);
      }
    }

    // Scopes
    if (member.http.scopes && member.http.scopes.length > 0) {
      lines.push("");
      lines.push(`Scopes: ${member.http.scopes.join(", ")}`);
    }
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

  // Since version
  if (member.since) {
    lines.push("");
    lines.push(`Since: ${member.since}`);
  }

  return lines.join("\n");
}

function formatExamplesExtraction(examples: Example[] | undefined): string {
  if (!examples || examples.length === 0) {
    return "No examples available.";
  }
  const lines: string[] = [];
  for (const example of examples) {
    if (lines.length > 0) lines.push("");
    if (example.title) {
      const lang = example.language ? ` (${example.language})` : "";
      lines.push(`## ${example.title}${lang}`);
    }
    if (example.description) {
      lines.push(example.description);
    }
    lines.push(example.code);
  }
  return lines.join("\n");
}

function formatParametersExtraction(parameters: import("../schema/index.js").Parameter[] | undefined): string {
  if (!parameters || parameters.length === 0) {
    return "No parameters available.";
  }
  const lines: string[] = [];
  for (const param of parameters) {
    const type = param.type || "any";
    const desc = param.description || "";
    const required = param.required ? "(required)" : "";
    const defaultVal = param.default !== undefined ? `(default: ${JSON.stringify(param.default)})` : "";
    const parts = [param.name, type, desc, required, defaultVal].filter(Boolean);
    lines.push(parts.join("  "));
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
  if (section.sections) {
    if (options.full) {
      for (const sub of section.sections) {
        lines.push("");
        lines.push(formatSection(sub, options));
      }
    } else if (section.sections.length > 0) {
      lines.push("");
      lines.push("Subsections:");
      for (const sub of section.sections) {
        const summary = sub.summary ? ` — ${sub.summary}` : "";
        lines.push(`  ${sub.id}${summary}`);
      }
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

  // oneOf (union types)
  if (schema.oneOf && schema.oneOf.length > 0) {
    const typeLabel = schema.type ? `Type: ${schema.type}` : "Union type";
    lines.push(typeLabel);
    if (schema.description) {
      lines.push(schema.description);
    }
    lines.push("");
    lines.push("One of:");
    for (const variant of schema.oneOf) {
      const variantType = variant.type || variant.$ref || "any";
      const desc = variant.description ? ` — ${variant.description}` : "";
      lines.push(`  - ${variantType}${desc}`);
    }
    return lines.join("\n");
  }

  // allOf (intersection types)
  if (schema.allOf && schema.allOf.length > 0) {
    lines.push("Type: object (allOf)");
    if (schema.description) {
      lines.push(schema.description);
    }
    lines.push("");
    for (const part of schema.allOf) {
      if (part.$ref) {
        lines.push(`  From ${part.$ref}: (referenced schema)`);
      } else if (part.properties) {
        const source = part.description || "inline";
        const propNames = Object.keys(part.properties).join(", ");
        lines.push(`  From ${source}: ${propNames}`);
      }
    }
    return lines.join("\n");
  }

  const type = schema.type || "any";
  const formatSuffix = schema.format ? ` (format: ${schema.format})` : "";
  const nullableSuffix = schema.nullable ? " (nullable)" : "";
  lines.push(`Type: ${type}${formatSuffix}${nullableSuffix}`);

  if (schema.description) {
    lines.push(schema.description);
  }

  if (schema.enum) {
    lines.push(`Enum: ${schema.enum.map((v) => JSON.stringify(v)).join(" | ")}`);
  }

  // Top-level constraints
  const constraints: string[] = [];
  if (schema.minimum !== undefined) constraints.push(`minimum=${schema.minimum}`);
  if (schema.maximum !== undefined) constraints.push(`maximum=${schema.maximum}`);
  if (constraints.length > 0) {
    lines.push(`Constraints: ${constraints.join(", ")}`);
  }

  if (schema.pattern) {
    lines.push(`Pattern: ${schema.pattern}`);
  }

  const lengthParts: string[] = [];
  if (schema.minLength !== undefined) lengthParts.push(`Min length: ${schema.minLength}`);
  if (schema.maxLength !== undefined) lengthParts.push(`Max length: ${schema.maxLength}`);
  if (lengthParts.length > 0) {
    lines.push(lengthParts.join(", "));
  }

  if (schema.default !== undefined) {
    lines.push(`Default: ${JSON.stringify(schema.default)}`);
  }

  if (schema.example !== undefined) {
    lines.push(`Example: ${JSON.stringify(schema.example)}`);
  }

  if (schema.properties) {
    lines.push("");
    lines.push("Properties:");
    for (const [name, prop] of Object.entries(schema.properties)) {
      const required = schema.required?.includes(name) ? " (required)" : "";
      const propType = prop.type || prop.$ref || "any";
      const propFormat = prop.format ? ` (format: ${prop.format})` : "";
      const propNullable = prop.nullable ? " (nullable)" : "";
      const desc = prop.description ? `  ${prop.description}` : "";
      const propDefault = prop.default !== undefined ? `  (default: ${JSON.stringify(prop.default)})` : "";
      const propExample = prop.example !== undefined ? `  Example: ${JSON.stringify(prop.example)}` : "";
      lines.push(`  ${name}: ${propType}${propFormat}${propNullable}${required}${desc}${propDefault}${propExample}`);

      // Property-level constraints
      const propConstraints: string[] = [];
      if (prop.minimum !== undefined) propConstraints.push(`minimum=${prop.minimum}`);
      if (prop.maximum !== undefined) propConstraints.push(`maximum=${prop.maximum}`);
      if (propConstraints.length > 0) {
        lines.push(`    Constraints: ${propConstraints.join(", ")}`);
      }

      if (prop.pattern) {
        lines.push(`    Pattern: ${prop.pattern}`);
      }

      const propLengthParts: string[] = [];
      if (prop.minLength !== undefined) propLengthParts.push(`Min length: ${prop.minLength}`);
      if (prop.maxLength !== undefined) propLengthParts.push(`Max length: ${prop.maxLength}`);
      if (propLengthParts.length > 0) {
        lines.push(`    ${propLengthParts.join(", ")}`);
      }
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
