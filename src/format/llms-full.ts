/**
 * llms-full Formatter
 *
 * Formats a Package IR into a single concatenated markdown file
 * following the llms-full.txt convention.
 */

import type { Package, Member, Schema, Guide, Section } from "../schema/index.js";

/**
 * Format a Package into a single llms-full.txt markdown string.
 */
export function formatLlmsFull(pkg: Package): string {
  const lines: string[] = [];

  // Package header
  lines.push(`# ${pkg.name}`);
  lines.push("");

  if (pkg.summary) {
    lines.push(`> ${pkg.summary}`);
    lines.push("");
  }

  if (pkg.description) {
    lines.push(pkg.description);
    lines.push("");
  }

  // Module listing (namespaces with children)
  const namespaces = pkg.members.filter(
    (m) => m.children && m.children.length > 0
  );
  const flatMembers = pkg.members.filter(
    (m) => !m.children || m.children.length === 0
  );

  if (namespaces.length > 0) {
    lines.push("## Modules");
    lines.push("");
    for (const ns of namespaces) {
      lines.push(`- **${ns.name}** — ${ns.summary || ns.description || ""}`);
    }
    lines.push("");
  }

  // Flat members (no children) get H2 headings
  for (const member of flatMembers) {
    lines.push("---");
    lines.push("");
    formatMemberH2(lines, member, member.name);
  }

  // Namespace members
  for (const ns of namespaces) {
    lines.push("---");
    lines.push("");
    lines.push(`## ${ns.name}`);
    lines.push("");

    if (ns.description) {
      lines.push(ns.description);
      lines.push("");
    } else if (ns.summary) {
      lines.push(ns.summary);
      lines.push("");
    }

    if (ns.children) {
      for (const child of ns.children) {
        formatMemberH3(lines, child, `${ns.name}.${child.name}`);
      }
    }
  }

  // Types/Schemas
  const schemaEntries = Object.entries(pkg.schemas);
  if (schemaEntries.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Types");
    lines.push("");

    for (const [name, schema] of schemaEntries) {
      formatSchemaH3(lines, name, schema);
    }
  }

  // Guides
  for (const guide of pkg.guides) {
    lines.push("---");
    lines.push("");
    formatGuideH2(lines, guide);
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

function formatMemberH2(lines: string[], member: Member, path: string): void {
  lines.push(`## ${path}`);
  lines.push("");
  formatMemberBody(lines, member, "###");
}

function formatMemberH3(lines: string[], member: Member, path: string): void {
  lines.push(`### ${path}`);
  lines.push("");
  formatMemberBody(lines, member, "####");
}

function formatMemberBody(
  lines: string[],
  member: Member,
  subHeading: string
): void {
  if (member.summary) {
    lines.push(member.summary);
    lines.push("");
  }

  if (member.description && member.description !== member.summary) {
    lines.push(member.description);
    lines.push("");
  }

  if (member.http) {
    lines.push(
      `**Endpoint:** \`${member.http.method} ${member.http.path}\``
    );
    lines.push("");
  }

  if (member.signature) {
    lines.push("```");
    lines.push(member.signature);
    lines.push("```");
    lines.push("");
  }

  if (member.parameters && member.parameters.length > 0) {
    lines.push("**Parameters:**");
    lines.push("");

    // Determine columns based on what's present
    const hasIn = member.parameters.some((p) => p.in);
    const hasDefault = member.parameters.some((p) => p.default !== undefined);

    if (hasIn && hasDefault) {
      lines.push("| Name | Type | In | Required | Default | Description |");
      lines.push("|------|------|-----|----------|---------|-------------|");
    } else if (hasIn) {
      lines.push("| Name | Type | In | Required | Description |");
      lines.push("|------|------|-----|----------|-------------|");
    } else if (hasDefault) {
      lines.push("| Name | Type | Required | Default | Description |");
      lines.push("|------|------|----------|---------|-------------|");
    } else {
      lines.push("| Name | Type | Required | Description |");
      lines.push("|------|------|----------|-------------|");
    }

    for (const param of member.parameters) {
      const name = param.name;
      const type = param.type ? `\`${param.type}\`` : "-";
      const required = param.required ? "Yes" : "No";
      const desc = param.description || "";

      if (hasIn && hasDefault) {
        const inCol = param.in || "-";
        const def = param.default !== undefined ? `\`${param.default}\`` : "";
        lines.push(
          `| ${name} | ${type} | ${inCol} | ${required} | ${def} | ${desc} |`
        );
      } else if (hasIn) {
        const inCol = param.in || "-";
        lines.push(
          `| ${name} | ${type} | ${inCol} | ${required} | ${desc} |`
        );
      } else if (hasDefault) {
        const def = param.default !== undefined ? `\`${param.default}\`` : "";
        lines.push(
          `| ${name} | ${type} | ${required} | ${def} | ${desc} |`
        );
      } else {
        lines.push(`| ${name} | ${type} | ${required} | ${desc} |`);
      }
    }
    lines.push("");
  }

  if (member.returns) {
    const type = member.returns.type ? `\`${member.returns.type}\`` : "";
    const desc = member.returns.description
      ? ` — ${member.returns.description}`
      : "";
    lines.push(`**Returns:** ${type}${desc}`);
    lines.push("");
  }

  if (member.examples && member.examples.length > 0) {
    for (const example of member.examples) {
      if (example.title) {
        lines.push(`**${example.title}:**`);
        lines.push("");
      } else {
        lines.push("**Example:**");
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

  if (member.deprecated) {
    lines.push(`> **Deprecated:** ${member.deprecated}`);
    lines.push("");
  }
}

function formatSchemaH3(
  lines: string[],
  name: string,
  schema: Schema
): void {
  lines.push(`### ${name}`);
  lines.push("");

  if (schema.$ref) {
    lines.push(`*Reference to* \`${schema.$ref}\``);
    lines.push("");
    return;
  }

  if (schema.description) {
    lines.push(schema.description);
    lines.push("");
  }

  const type = schema.type || "any";
  lines.push(`**Type:** \`${type}\`${schema.nullable ? " | null" : ""}`);
  lines.push("");

  if (schema.enum) {
    lines.push(
      `**Values:** ${schema.enum.map((v) => `\`${v}\``).join(", ")}`
    );
    lines.push("");
  }

  if (schema.properties) {
    lines.push("| Property | Type | Required | Description |");
    lines.push("|----------|------|----------|-------------|");
    for (const [propName, prop] of Object.entries(schema.properties)) {
      const required = schema.required?.includes(propName) ? "Yes" : "No";
      const propType = prop.type || prop.$ref || "any";
      lines.push(
        `| ${propName} | \`${propType}\` | ${required} | ${prop.description || ""} |`
      );
    }
    lines.push("");
  }

  if (schema.items) {
    const itemType = schema.items.type || schema.items.$ref || "any";
    lines.push(`**Items:** \`${itemType}\``);
    lines.push("");
  }
}

function formatGuideH2(lines: string[], guide: Guide): void {
  lines.push(`## Guide: ${guide.title}`);
  lines.push("");

  if (guide.summary) {
    lines.push(`> ${guide.summary}`);
    lines.push("");
  }

  if (guide.intro) {
    lines.push(guide.intro);
    lines.push("");
  }

  for (const section of guide.sections) {
    formatSectionAtLevel(lines, section, 3);
  }
}

function formatSectionAtLevel(
  lines: string[],
  section: Section,
  level: number
): void {
  const heading = "#".repeat(level);
  lines.push(`${heading} ${section.title}`);
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

  if (section.sections) {
    for (const sub of section.sections) {
      formatSectionAtLevel(lines, sub, Math.min(level + 1, 6));
    }
  }
}
