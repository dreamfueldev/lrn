/**
 * Orientation Blurb Generation
 *
 * Generates short, classification-specific orientation blurbs
 * that teach LLMs how to query each package.
 */

import type { Package, Member } from "./schema/index.js";
import { detectClassification } from "./classify.js";

/**
 * Generate an orientation blurb for a package.
 * The blurb includes a header, summary line, and 2-3 example queries
 * tailored to the package's classification.
 */
export function generateBlurb(pkg: Package): string {
  const classification = detectClassification(pkg);
  const lines: string[] = [];

  // Header
  const version = pkg.version ? ` (v${pkg.version})` : "";
  lines.push(`### ${pkg.name}${version}`);

  // Summary + content counts
  const desc = pkg.summary || pkg.description || "";
  const counts = summarizeContents(pkg);
  const summaryParts = [desc, counts].filter(Boolean);
  lines.push(summaryParts.join(". ") + (summaryParts.length > 0 ? "." : ""));

  // Classification-specific example queries
  switch (classification) {
    case "api": {
      const childPath = firstChildPath(pkg);
      if (childPath) {
        lines.push(`→ \`lrn ${pkg.name} ${childPath}\` for endpoint details`);
      }
      const tag = pickTag(pkg);
      if (tag) {
        lines.push(`→ \`lrn ${pkg.name} list --tag ${tag}\` to discover by domain`);
      }
      const typeName = firstSchemaName(pkg);
      if (typeName) {
        lines.push(`→ \`lrn ${pkg.name} type ${typeName}\` for request/response shapes`);
      }
      break;
    }

    case "library": {
      const member = firstMemberName(pkg);
      if (member) {
        lines.push(`→ \`lrn ${pkg.name} ${member}\` for usage and signature`);
      }
      lines.push(`→ \`lrn ${pkg.name} list --kind function\` to browse functions`);
      if (pkg.guides.length > 0) {
        lines.push(`→ \`lrn ${pkg.name} guide ${pkg.guides[0]!.slug}\` for getting started`);
      }
      break;
    }

    case "components": {
      const comp = firstMemberName(pkg);
      if (comp) {
        lines.push(`→ \`lrn ${pkg.name} ${comp}\` for classes, syntax, and rules`);
      }
      lines.push(`→ \`lrn ${pkg.name} search <term>\` to find components`);
      if (pkg.guides.length > 0) {
        const conceptGuide = pkg.guides.find((g) => g.kind === "concept");
        const slug = conceptGuide?.slug || pkg.guides[0]!.slug;
        lines.push(`→ \`lrn ${pkg.name} guide ${slug}\` for the design system`);
      }
      break;
    }

    case "cli": {
      const cmd = firstMemberName(pkg);
      if (cmd) {
        lines.push(`→ \`lrn ${pkg.name} ${cmd}\` for flags and usage`);
      }
      lines.push(`→ \`lrn ${pkg.name} list\` to see all commands`);
      const tag = pickTag(pkg);
      if (tag) {
        lines.push(`→ \`lrn ${pkg.name} list --tag ${tag}\` for related commands`);
      }
      break;
    }

    case "config": {
      const resource = firstMemberName(pkg);
      if (resource) {
        lines.push(`→ \`lrn ${pkg.name} ${resource}\` for resource arguments`);
      }
      const tag = pickTag(pkg);
      if (tag) {
        lines.push(`→ \`lrn ${pkg.name} list --tag ${tag}\` to browse by category`);
      }
      lines.push(`→ \`lrn ${pkg.name} search <term>\` to find resources`);
      break;
    }

    case "framework": {
      lines.push(`→ \`lrn ${pkg.name} list\` to see all APIs and features`);
      lines.push(`→ \`lrn ${pkg.name} search <term>\` to find specific functionality`);
      if (pkg.guides.length > 0) {
        lines.push(`→ \`lrn ${pkg.name} guides\` for tutorials and concepts`);
      }
      break;
    }
  }

  return lines.join("\n");
}

/** Count all members recursively */
function countAllMembers(members: Member[]): number {
  let count = 0;
  for (const m of members) {
    count++;
    if (m.children) {
      count += countAllMembers(m.children);
    }
  }
  return count;
}

/** "N members, M guides" */
function summarizeContents(pkg: Package): string {
  const memberCount = countAllMembers(pkg.members);
  const guideCount = pkg.guides.length;
  const parts: string[] = [];
  if (memberCount > 0) parts.push(`${memberCount} members`);
  if (guideCount > 0) parts.push(`${guideCount} ${guideCount === 1 ? "guide" : "guides"}`);
  return parts.join(", ");
}

/** First top-level member name */
function firstMemberName(pkg: Package): string | undefined {
  return pkg.members[0]?.name;
}

/** "namespace.child" for API-style packages */
function firstChildPath(pkg: Package): string | undefined {
  for (const m of pkg.members) {
    if (m.children && m.children.length > 0) {
      return `${m.name}.${m.children[0]!.name}`;
    }
  }
  // Fallback to first member name
  return pkg.members[0]?.name;
}

/** First schema name */
function firstSchemaName(pkg: Package): string | undefined {
  const names = Object.keys(pkg.schemas);
  return names[0];
}

/** Most frequent non-generic tag across members */
function pickTag(pkg: Package): string | undefined {
  const genericTags = new Set(["deprecated", "internal", "experimental"]);
  const counts = new Map<string, number>();

  for (const m of pkg.members) {
    collectTags(m, counts);
  }

  let best: string | undefined;
  let bestCount = 0;
  for (const [tag, count] of counts) {
    if (!genericTags.has(tag) && count > bestCount) {
      best = tag;
      bestCount = count;
    }
  }
  return best;
}

function collectTags(member: Member, counts: Map<string, number>): void {
  if (member.tags) {
    for (const tag of member.tags) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  if (member.children) {
    for (const child of member.children) {
      collectTags(child, counts);
    }
  }
}
