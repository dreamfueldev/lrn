/**
 * Check Registry
 *
 * Central registry of all health checks and runner.
 */

import type { Check, Issue, FileContext, CheckContext } from "../types.js";
import { structureChecks } from "./structure.js";
import { contentChecks } from "./content.js";
import { formatChecks } from "./format.js";
import { referenceChecks } from "./reference.js";

/**
 * All registered checks
 */
export const allChecks: Check[] = [
  ...structureChecks,
  ...contentChecks,
  ...formatChecks,
  ...referenceChecks,
];

/**
 * Get checks filtered by tier and file type
 */
export function getChecksForFile(
  file: FileContext,
  tier: 1 | 2
): Check[] {
  return allChecks.filter((check) => {
    // Filter by tier
    if (check.tier > tier) return false;

    // Filter by file type if check specifies applicable types
    if (check.appliesTo && !check.appliesTo.includes(file.type)) {
      return false;
    }

    return true;
  });
}

/**
 * Run all applicable checks on a file
 *
 * @param file - The file to check
 * @param context - Shared context for all checks
 * @returns Array of issues found
 */
export function runChecks(
  file: FileContext,
  context: CheckContext
): Issue[] {
  const issues: Issue[] = [];

  // Determine tier based on whether parsing succeeded
  // Tier 1 checks run on raw content, Tier 2 requires parsed tokens
  const hasParsedTokens = !!file.tokens;

  // Add parse error as P001 if parsing failed
  if (file.parseError) {
    issues.push({
      checkId: "P001",
      severity: "error",
      category: "structure",
      file: file.path,
      line: 1,
      message: `Failed to parse markdown: ${file.parseError}`,
      suggestion: "Fix markdown syntax errors",
    });
  }

  // Get applicable checks
  const checks = getChecksForFile(file, hasParsedTokens ? 2 : 1);

  // Run each check
  for (const check of checks) {
    try {
      const checkIssues = check.check(file, context);
      issues.push(...checkIssues);
    } catch (err) {
      // Log check errors but don't fail completely
      console.error(
        `Error running check ${check.id} on ${file.path}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return issues;
}

/**
 * Run all checks on all files
 */
export function runAllChecks(
  files: FileContext[],
  context: CheckContext
): Issue[] {
  const issues: Issue[] = [];

  for (const file of files) {
    const fileIssues = runChecks(file, context);
    issues.push(...fileIssues);
  }

  return issues;
}

// Re-export individual check modules for testing
export { structureChecks } from "./structure.js";
export { contentChecks } from "./content.js";
export { formatChecks } from "./format.js";
export { referenceChecks } from "./reference.js";
