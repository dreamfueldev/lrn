/**
 * Structure Checks (S001-S006)
 *
 * Validates structural requirements of lrn-compatible markdown.
 */

import type { Check, Issue, FileContext, CheckContext } from "../types.js";
import { getLineNumber } from "../discovery.js";
import {
  extractH1,
  extractMetadata,
  type Token,
  type Tokens,
} from "../../parse/markdown.js";

/**
 * S001: Package index.md must have H1 with package name
 */
export const S001: Check = {
  id: "S001",
  name: "Package index.md must have H1 with package name",
  category: "structure",
  severity: "error",
  tier: 2,
  appliesTo: ["package"],
  check: (file: FileContext, _context: CheckContext): Issue[] => {
    if (!file.tokens) return [];

    const h1 = extractH1(file.tokens);
    if (!h1) {
      return [
        {
          checkId: "S001",
          severity: "error",
          category: "structure",
          file: file.path,
          line: 1,
          message: "Package index.md missing H1 heading with package name",
          suggestion: "Add a top-level heading: # PackageName",
        },
      ];
    }

    return [];
  },
};

/**
 * S002: Member files must have H1 with member name
 */
export const S002: Check = {
  id: "S002",
  name: "Member files must have H1 with member name",
  category: "structure",
  severity: "error",
  tier: 2,
  appliesTo: ["member"],
  check: (file: FileContext, _context: CheckContext): Issue[] => {
    if (!file.tokens) return [];

    const h1 = extractH1(file.tokens);
    if (!h1) {
      return [
        {
          checkId: "S002",
          severity: "error",
          category: "structure",
          file: file.path,
          line: 1,
          message: "Member file missing H1 heading with member name",
          suggestion: "Add a top-level heading: # memberName",
        },
      ];
    }

    return [];
  },
};

/**
 * S003: Member files must have Kind declaration
 */
export const S003: Check = {
  id: "S003",
  name: "Member files must have Kind declaration",
  category: "structure",
  severity: "error",
  tier: 2,
  appliesTo: ["member"],
  check: (file: FileContext, _context: CheckContext): Issue[] => {
    if (!file.tokens) return [];

    const kind = extractMetadata(file.tokens, "Kind");
    if (!kind) {
      return [
        {
          checkId: "S003",
          severity: "error",
          category: "structure",
          file: file.path,
          message: "Member file missing Kind declaration",
          suggestion:
            "Add: **Kind:** function (or method, class, namespace, constant, type, property, component, command, resource)",
        },
      ];
    }

    // Validate kind value
    const validKinds = [
      "function",
      "method",
      "class",
      "namespace",
      "constant",
      "type",
      "property",
      "component",
      "command",
      "resource",
    ];
    if (!validKinds.includes(kind.toLowerCase())) {
      return [
        {
          checkId: "S003",
          severity: "error",
          category: "structure",
          file: file.path,
          message: `Invalid Kind value: "${kind}"`,
          suggestion: `Valid kinds are: ${validKinds.join(", ")}`,
        },
      ];
    }

    return [];
  },
};

/**
 * S004: Heading hierarchy should be sequential (H1 > H2 > H3)
 */
export const S004: Check = {
  id: "S004",
  name: "Heading hierarchy should be sequential",
  category: "structure",
  severity: "warning",
  tier: 2,
  check: (file: FileContext, _context: CheckContext): Issue[] => {
    if (!file.tokens) return [];

    const issues: Issue[] = [];
    let prevLevel = 0;
    let lineNumber = 1;

    for (const token of file.tokens) {
      if (token.type === "heading") {
        const headingToken = token as Tokens.Heading;
        const level = headingToken.depth;

        // Find approximate line number
        const rawText = (token as { raw?: string }).raw || "";
        const idx = file.content.indexOf(rawText);
        if (idx !== -1) {
          lineNumber = getLineNumber(file.content, idx);
        }

        // Check for skipped levels (e.g., H1 -> H3)
        if (prevLevel > 0 && level > prevLevel + 1) {
          issues.push({
            checkId: "S004",
            severity: "warning",
            category: "structure",
            file: file.path,
            line: lineNumber,
            message: `Heading level skipped from H${prevLevel} to H${level}`,
            suggestion: `Use H${prevLevel + 1} instead of H${level}`,
            fixable: true,
          });
        }

        prevLevel = level;
      }
    }

    return issues;
  },
};

/**
 * S005: Guide files should have Type declaration
 */
export const S005: Check = {
  id: "S005",
  name: "Guide files should have Type declaration",
  category: "structure",
  severity: "warning",
  tier: 2,
  appliesTo: ["guide"],
  check: (file: FileContext, _context: CheckContext): Issue[] => {
    if (!file.tokens) return [];

    const guideType = extractMetadata(file.tokens, "Type");
    if (!guideType) {
      return [
        {
          checkId: "S005",
          severity: "warning",
          category: "structure",
          file: file.path,
          message: "Guide file missing Type declaration",
          suggestion:
            "Add: **Type:** quickstart (or tutorial, concept, howto, example)",
        },
      ];
    }

    // Validate type value
    const validTypes = ["quickstart", "tutorial", "concept", "howto", "example"];
    if (!validTypes.includes(guideType.toLowerCase())) {
      return [
        {
          checkId: "S005",
          severity: "warning",
          category: "structure",
          file: file.path,
          message: `Invalid guide Type value: "${guideType}"`,
          suggestion: `Valid types are: ${validTypes.join(", ")}`,
        },
      ];
    }

    return [];
  },
};

/**
 * S006: Schema files should have H1 with type name
 */
export const S006: Check = {
  id: "S006",
  name: "Schema files should have H1 with type name",
  category: "structure",
  severity: "info",
  tier: 2,
  appliesTo: ["schema"],
  check: (file: FileContext, _context: CheckContext): Issue[] => {
    if (!file.tokens) return [];

    const h1 = extractH1(file.tokens);
    if (!h1) {
      return [
        {
          checkId: "S006",
          severity: "info",
          category: "structure",
          file: file.path,
          line: 1,
          message: "Schema file missing H1 heading with type name",
          suggestion: "Add a top-level heading: # TypeName",
        },
      ];
    }

    return [];
  },
};

/**
 * All structure checks
 */
export const structureChecks: Check[] = [S001, S002, S003, S004, S005, S006];
