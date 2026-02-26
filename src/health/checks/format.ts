/**
 * Format Checks (F001-F005)
 *
 * Validates formatting requirements of lrn-compatible markdown.
 */

import type { Check, Issue, FileContext, CheckContext } from "../types.js";
import { getLineNumber } from "../discovery.js";
import {
  extractSection,
  extractTableMarkdown,
  extractMetadata,
  type Tokens,
} from "../../parse/markdown.js";

/**
 * F001: Parameter table must have Name, Type, Required columns
 */
export const F001: Check = {
  id: "F001",
  name: "Parameter table must have Name, Type, Required columns",
  category: "format",
  severity: "error",
  tier: 2,
  appliesTo: ["member"],
  check: (file: FileContext, _context: CheckContext): Issue[] => {
    if (!file.tokens) return [];

    // Find parameters section
    const paramsSection = extractSection(file.tokens, "Parameters");
    if (paramsSection.length === 0) return [];

    // Check for table in parameters section
    const tableMarkdown = extractTableMarkdown(paramsSection);
    if (!tableMarkdown) return [];

    // Parse table header
    const lines = tableMarkdown.trim().split("\n");
    if (lines.length < 2) return [];

    const headerLine = lines[0]!.toLowerCase();

    // Check for required columns
    const issues: Issue[] = [];
    const requiredColumns = ["name", "type", "required"];
    const missingColumns: string[] = [];

    for (const col of requiredColumns) {
      if (!headerLine.includes(col)) {
        missingColumns.push(col);
      }
    }

    if (missingColumns.length > 0) {
      const idx = file.content.indexOf(tableMarkdown);
      const line = idx !== -1 ? getLineNumber(file.content, idx) : undefined;

      issues.push({
        checkId: "F001",
        severity: "error",
        category: "format",
        file: file.path,
        line,
        message: `Parameter table missing columns: ${missingColumns.join(", ")}`,
        suggestion:
          "Parameter table should have columns: | Name | Type | Required | Description |",
      });
    }

    return issues;
  },
};

/**
 * F002: Code blocks must have language tag
 */
export const F002: Check = {
  id: "F002",
  name: "Code blocks must have language tag",
  category: "format",
  severity: "error",
  tier: 2, // Use parsed tokens to correctly identify code blocks
  check: (file: FileContext, _context: CheckContext): Issue[] => {
    if (!file.tokens) return [];

    const issues: Issue[] = [];

    for (const token of file.tokens) {
      if (token.type === "code") {
        const codeToken = token as Tokens.Code;
        if (!codeToken.lang) {
          // Find line number by searching for the code block in content
          const codeStart = file.content.indexOf("```\n" + codeToken.text);
          const line =
            codeStart !== -1 ? getLineNumber(file.content, codeStart) : undefined;

          issues.push({
            checkId: "F002",
            severity: "error",
            category: "format",
            file: file.path,
            line,
            message: "Code block missing language tag",
            suggestion: "Add a language like ```typescript or ```json",
            fixable: true,
          });
        }
      }
    }

    return issues;
  },
};

/**
 * F003: HTTP endpoint must match pattern `METHOD /path`
 */
export const F003: Check = {
  id: "F003",
  name: "HTTP endpoint must match pattern",
  category: "format",
  severity: "warning",
  tier: 2,
  appliesTo: ["member"],
  check: (file: FileContext, _context: CheckContext): Issue[] => {
    if (!file.tokens) return [];

    const endpoint = extractMetadata(file.tokens, "Endpoint");
    if (!endpoint) return [];

    // Remove backticks for checking
    const cleaned = endpoint.replace(/`/g, "").trim();

    // Validate pattern: METHOD /path
    const validMethods = [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "PATCH",
      "HEAD",
      "OPTIONS",
    ];
    const pattern = /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+\/.*/i;

    if (!pattern.test(cleaned)) {
      return [
        {
          checkId: "F003",
          severity: "warning",
          category: "format",
          file: file.path,
          message: `Invalid endpoint format: "${endpoint}"`,
          suggestion: `Use format: \`METHOD /path\` (e.g., \`GET /v1/users\`)`,
        },
      ];
    }

    // Check for valid HTTP method
    const methodMatch = cleaned.match(/^(\w+)/);
    if (methodMatch) {
      const method = methodMatch[1]!.toUpperCase();
      if (!validMethods.includes(method)) {
        return [
          {
            checkId: "F003",
            severity: "warning",
            category: "format",
            file: file.path,
            message: `Invalid HTTP method: "${method}"`,
            suggestion: `Valid methods are: ${validMethods.join(", ")}`,
          },
        ];
      }
    }

    return [];
  },
};

/**
 * F004: Tags should be comma-separated in backticks
 */
export const F004: Check = {
  id: "F004",
  name: "Tags should be comma-separated in backticks",
  category: "format",
  severity: "warning",
  tier: 2,
  check: (file: FileContext, _context: CheckContext): Issue[] => {
    if (!file.tokens) return [];

    const tags = extractMetadata(file.tokens, "Tags");
    if (!tags) return [];

    // Check format: should be `tag1`, `tag2`, `tag3`
    // Simple validation: check if tags contain backticks
    const hasBackticks = tags.includes("`");

    if (!hasBackticks) {
      return [
        {
          checkId: "F004",
          severity: "warning",
          category: "format",
          file: file.path,
          message: "Tags should use backticks",
          suggestion:
            'Use format: **Tags:** `tag1`, `tag2`, `tag3`',
        },
      ];
    }

    return [];
  },
};

/**
 * F005: Signature code block should use typescript language
 *
 * Kind-aware: component/command/resource members are expected to have
 * non-TypeScript signatures (html, bash, hcl, etc.), so they are exempt.
 */
export const F005: Check = {
  id: "F005",
  name: "Signature code block should use typescript language",
  category: "format",
  severity: "info",
  tier: 2,
  appliesTo: ["member"],
  check: (file: FileContext, _context: CheckContext): Issue[] => {
    if (!file.tokens) return [];

    // Non-TS-native kinds are exempt from this check
    const kind = extractMetadata(file.tokens, "Kind")?.toLowerCase();
    const nonTsKinds = ["component", "command", "resource"];
    if (kind && nonTsKinds.includes(kind)) return [];

    // Find first code block (should be signature)
    for (const token of file.tokens) {
      if (token.type === "code") {
        const codeToken = token as Tokens.Code;
        const lang = codeToken.lang?.toLowerCase();

        // If it's a signature (appears before any H2), check language
        if (lang && lang !== "typescript" && lang !== "ts") {
          // Check if this is before any H2
          let beforeH2 = true;
          for (const t of file.tokens) {
            if (t === token) break;
            if (t.type === "heading" && (t as Tokens.Heading).depth === 2) {
              beforeH2 = false;
              break;
            }
          }

          if (beforeH2 && lang !== "javascript" && lang !== "js") {
            const line = getLineNumber(
              file.content,
              file.content.indexOf("```" + codeToken.lang)
            );
            return [
              {
                checkId: "F005",
                severity: "info",
                category: "format",
                file: file.path,
                line,
                message: `Signature code block uses "${lang}" instead of typescript`,
                suggestion: "Use typescript for signature code blocks",
              },
            ];
          }
        }

        break; // Only check first code block
      }
    }

    return [];
  },
};

/**
 * All format checks
 */
export const formatChecks: Check[] = [F001, F002, F003, F004, F005];
