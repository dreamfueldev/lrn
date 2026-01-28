/**
 * Reference Checks (R001-R004)
 *
 * Validates internal and external references in lrn-compatible markdown.
 */

import type { Check, Issue, FileContext, CheckContext } from "../types.js";
import { getLineNumber } from "../discovery.js";

/**
 * Extract all markdown links from content
 * Returns array of { text, target, index }
 */
function extractLinks(
  content: string
): Array<{ text: string; target: string; index: number }> {
  const links: Array<{ text: string; target: string; index: number }> = [];

  // Match [text](target)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    links.push({
      text: match[1]!,
      target: match[2]!,
      index: match.index,
    });
  }

  return links;
}

/**
 * Check if a target is a member reference
 */
function isMemberReference(target: string): boolean {
  // Member references: member:path or just path.to.member
  if (target.startsWith("member:")) return true;
  if (target.startsWith("http://") || target.startsWith("https://")) return false;
  if (target.startsWith("guide:") || target.startsWith("guides/")) return false;
  if (target.startsWith("schema:") || target.startsWith("types/")) return false;
  if (target.startsWith("#")) return false; // Anchor link
  if (target.includes("/")) return false; // Path with slashes is likely file path

  // Plain dotted path like "charges.create"
  return /^[\w.]+$/.test(target);
}

/**
 * Check if a target is a guide reference
 */
function isGuideReference(target: string): boolean {
  return target.startsWith("guide:") || target.startsWith("guides/");
}

/**
 * Check if a target is a schema reference
 */
function isSchemaReference(target: string): boolean {
  return target.startsWith("schema:") || target.startsWith("types/");
}

/**
 * Check if a target is an external URL
 */
function isExternalUrl(target: string): boolean {
  return target.startsWith("http://") || target.startsWith("https://");
}

/**
 * Extract the actual reference path from a target
 */
function extractRefPath(target: string, prefix: string): string {
  return target.replace(new RegExp(`^${prefix}:?/?`), "").replace(/\.md$/, "");
}

/**
 * R001: Internal member references must resolve
 */
export const R001: Check = {
  id: "R001",
  name: "Internal member references must resolve",
  category: "reference",
  severity: "error",
  tier: 1,
  check: (file: FileContext, context: CheckContext): Issue[] => {
    const issues: Issue[] = [];
    const links = extractLinks(file.content);

    for (const link of links) {
      if (isMemberReference(link.target)) {
        const memberPath = extractRefPath(link.target, "member");

        if (!context.memberPaths.has(memberPath)) {
          const line = getLineNumber(file.content, link.index);
          issues.push({
            checkId: "R001",
            severity: "error",
            category: "reference",
            file: file.path,
            line,
            message: `Member reference not found: "${memberPath}"`,
            suggestion: `Check that a member file exists at members/${memberPath.replace(/\./g, "/")}.md`,
          });
        }
      }
    }

    return issues;
  },
};

/**
 * R002: Internal guide references must resolve
 */
export const R002: Check = {
  id: "R002",
  name: "Internal guide references must resolve",
  category: "reference",
  severity: "error",
  tier: 1,
  check: (file: FileContext, context: CheckContext): Issue[] => {
    const issues: Issue[] = [];
    const links = extractLinks(file.content);

    for (const link of links) {
      if (isGuideReference(link.target)) {
        const guideSlug = extractRefPath(link.target, "guide|guides");

        if (!context.guideSlugs.has(guideSlug)) {
          const line = getLineNumber(file.content, link.index);
          issues.push({
            checkId: "R002",
            severity: "error",
            category: "reference",
            file: file.path,
            line,
            message: `Guide reference not found: "${guideSlug}"`,
            suggestion: `Check that a guide file exists at guides/${guideSlug}.md`,
          });
        }
      }
    }

    return issues;
  },
};

/**
 * R003: Schema references should resolve
 */
export const R003: Check = {
  id: "R003",
  name: "Schema references should resolve",
  category: "reference",
  severity: "warning",
  tier: 1,
  check: (file: FileContext, context: CheckContext): Issue[] => {
    const issues: Issue[] = [];
    const links = extractLinks(file.content);

    for (const link of links) {
      if (isSchemaReference(link.target)) {
        const schemaName = extractRefPath(link.target, "schema|types");

        if (!context.schemaNames.has(schemaName)) {
          const line = getLineNumber(file.content, link.index);
          issues.push({
            checkId: "R003",
            severity: "warning",
            category: "reference",
            file: file.path,
            line,
            message: `Schema reference not found: "${schemaName}"`,
            suggestion: `Check that a schema file exists at types/${schemaName}.md`,
          });
        }
      }
    }

    return issues;
  },
};

/**
 * R004: External URLs should be valid format
 */
export const R004: Check = {
  id: "R004",
  name: "External URLs should be valid format",
  category: "reference",
  severity: "info",
  tier: 1,
  check: (file: FileContext, _context: CheckContext): Issue[] => {
    const issues: Issue[] = [];
    const links = extractLinks(file.content);

    for (const link of links) {
      if (isExternalUrl(link.target)) {
        try {
          new URL(link.target);
        } catch {
          const line = getLineNumber(file.content, link.index);
          issues.push({
            checkId: "R004",
            severity: "info",
            category: "reference",
            file: file.path,
            line,
            message: `Invalid URL format: "${link.target}"`,
            suggestion: "Ensure URL is well-formed (e.g., https://example.com/path)",
          });
        }
      }
    }

    return issues;
  },
};

/**
 * All reference checks
 */
export const referenceChecks: Check[] = [R001, R002, R003, R004];
