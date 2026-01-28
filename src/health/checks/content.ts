/**
 * Content Checks (C001-C006)
 *
 * Validates content completeness of lrn-compatible markdown.
 */

import type { Check, Issue, FileContext, CheckContext } from "../types.js";
import {
  extractFirstBlockquote,
  extractSection,
  extractMetadata,
  extractIntro,
  extractAllCodeBlocks,
} from "../../parse/markdown.js";

/**
 * C001: Members should have summary
 */
export const C001: Check = {
  id: "C001",
  name: "Members should have summary",
  category: "content",
  severity: "warning",
  tier: 2,
  appliesTo: ["member"],
  check: (file: FileContext, _context: CheckContext): Issue[] => {
    if (!file.tokens) return [];

    const summary = extractFirstBlockquote(file.tokens);
    if (!summary) {
      return [
        {
          checkId: "C001",
          severity: "warning",
          category: "content",
          file: file.path,
          message: "Member missing summary",
          suggestion:
            "Add a blockquote after the H1: > One-line summary of this member",
        },
      ];
    }

    return [];
  },
};

/**
 * C002: Members should have description
 */
export const C002: Check = {
  id: "C002",
  name: "Members should have description",
  category: "content",
  severity: "info",
  tier: 2,
  appliesTo: ["member"],
  check: (file: FileContext, _context: CheckContext): Issue[] => {
    if (!file.tokens) return [];

    const description = extractIntro(file.tokens);
    if (!description) {
      return [
        {
          checkId: "C002",
          severity: "info",
          category: "content",
          file: file.path,
          message: "Member missing description",
          suggestion:
            "Add descriptive text after the summary explaining what this member does",
        },
      ];
    }

    return [];
  },
};

/**
 * C003: Function members should have parameters section
 */
export const C003: Check = {
  id: "C003",
  name: "Function members should have parameters section",
  category: "content",
  severity: "warning",
  tier: 2,
  appliesTo: ["member"],
  check: (file: FileContext, _context: CheckContext): Issue[] => {
    if (!file.tokens) return [];

    // Check if this is a function/method
    const kind = extractMetadata(file.tokens, "Kind");
    const isFunction =
      !kind ||
      kind.toLowerCase() === "function" ||
      kind.toLowerCase() === "method";

    if (!isFunction) return [];

    // Check for parameters section
    const paramsSection = extractSection(file.tokens, "Parameters");
    if (paramsSection.length === 0) {
      return [
        {
          checkId: "C003",
          severity: "warning",
          category: "content",
          file: file.path,
          message: "Function/method missing Parameters section",
          suggestion:
            "Add a ## Parameters section with a table of parameters",
        },
      ];
    }

    return [];
  },
};

/**
 * C004: Function members should have returns section
 */
export const C004: Check = {
  id: "C004",
  name: "Function members should have returns section",
  category: "content",
  severity: "warning",
  tier: 2,
  appliesTo: ["member"],
  check: (file: FileContext, _context: CheckContext): Issue[] => {
    if (!file.tokens) return [];

    // Check if this is a function/method
    const kind = extractMetadata(file.tokens, "Kind");
    const isFunction =
      !kind ||
      kind.toLowerCase() === "function" ||
      kind.toLowerCase() === "method";

    if (!isFunction) return [];

    // Check for returns section
    const returnsSection = extractSection(file.tokens, "Returns");
    if (returnsSection.length === 0) {
      return [
        {
          checkId: "C004",
          severity: "warning",
          category: "content",
          file: file.path,
          message: "Function/method missing Returns section",
          suggestion: "Add a ## Returns section describing the return value",
        },
      ];
    }

    return [];
  },
};

/**
 * C005: Members should have at least one example
 */
export const C005: Check = {
  id: "C005",
  name: "Members should have at least one example",
  category: "content",
  severity: "info",
  tier: 2,
  appliesTo: ["member"],
  check: (file: FileContext, _context: CheckContext): Issue[] => {
    if (!file.tokens) return [];

    // Check for examples section
    const examplesSection = extractSection(file.tokens, "Examples");
    if (examplesSection.length === 0) {
      return [
        {
          checkId: "C005",
          severity: "info",
          category: "content",
          file: file.path,
          message: "Member missing Examples section",
          suggestion: "Add a ## Examples section with code examples",
        },
      ];
    }

    // Check if there are any code blocks in examples
    const codeBlocks = extractAllCodeBlocks(examplesSection);
    if (codeBlocks.length === 0) {
      return [
        {
          checkId: "C005",
          severity: "info",
          category: "content",
          file: file.path,
          message: "Examples section has no code blocks",
          suggestion: "Add at least one code example in the Examples section",
        },
      ];
    }

    return [];
  },
};

/**
 * C006: Guides should have summary
 */
export const C006: Check = {
  id: "C006",
  name: "Guides should have summary",
  category: "content",
  severity: "info",
  tier: 2,
  appliesTo: ["guide"],
  check: (file: FileContext, _context: CheckContext): Issue[] => {
    if (!file.tokens) return [];

    const summary = extractFirstBlockquote(file.tokens);
    if (!summary) {
      return [
        {
          checkId: "C006",
          severity: "info",
          category: "content",
          file: file.path,
          message: "Guide missing summary",
          suggestion:
            "Add a blockquote after the H1: > Brief description of this guide",
        },
      ];
    }

    return [];
  },
};

/**
 * All content checks
 */
export const contentChecks: Check[] = [C001, C002, C003, C004, C005, C006];
