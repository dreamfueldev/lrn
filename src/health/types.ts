/**
 * Health Command Types
 *
 * Core interfaces for the health check system.
 */

import type { Token } from "../parse/markdown.js";

/**
 * Severity levels for health issues
 */
export type Severity = "error" | "warning" | "info";

/**
 * Categories of health checks
 */
export type CheckCategory = "structure" | "content" | "format" | "reference";

/**
 * File types that can be checked
 */
export type FileType = "package" | "member" | "guide" | "schema" | "unknown";

/**
 * A health issue found during checking
 */
export interface Issue {
  /** Check ID (e.g., "S001", "F002") */
  checkId: string;
  /** Issue severity */
  severity: Severity;
  /** Check category */
  category: CheckCategory;
  /** Relative file path */
  file: string;
  /** Line number if available */
  line?: number;
  /** Human-readable message */
  message: string;
  /** Suggestion for fixing */
  suggestion?: string;
  /** Whether the issue can be auto-fixed */
  fixable?: boolean;
}

/**
 * Context for a single file being checked
 */
export interface FileContext {
  /** Relative file path */
  path: string;
  /** Absolute file path */
  absolutePath: string;
  /** File type (member, guide, schema, package) */
  type: FileType;
  /** Raw file content */
  content: string;
  /** Parsed markdown tokens (if parsing succeeded) */
  tokens?: Token[];
  /** Parse error if parsing failed */
  parseError?: string;
}

/**
 * Context shared across all checks
 */
export interface CheckContext {
  /** Base directory being checked */
  baseDir: string;
  /** All files being checked */
  allFiles: Map<string, FileContext>;
  /** Set of known member paths (for reference validation) */
  memberPaths: Set<string>;
  /** Set of known guide slugs (for reference validation) */
  guideSlugs: Set<string>;
  /** Set of known schema names (for reference validation) */
  schemaNames: Set<string>;
}

/**
 * A health check definition
 */
export interface Check {
  /** Check ID (e.g., "S001", "F002") */
  id: string;
  /** Human-readable name */
  name: string;
  /** Check category */
  category: CheckCategory;
  /** Issue severity */
  severity: Severity;
  /** Check tier: 1 = raw markdown, 2 = requires parsed tokens */
  tier: 1 | 2;
  /** File types this check applies to (undefined = all) */
  appliesTo?: FileType[];
  /** Run the check and return issues */
  check: (file: FileContext, context: CheckContext) => Issue[];
}

/**
 * Category scores in the health result
 */
export interface CategoryScores {
  structure: number;
  content: number;
  format: number;
  reference: number;
}

/**
 * Score result
 */
export interface Score {
  /** Overall score 0-100 */
  overall: number;
  /** Scores by category */
  categories: CategoryScores;
}

/**
 * Token breakdown by section type
 */
export interface TokenBreakdown {
  summaries: number;
  descriptions: number;
  parameters: number;
  examples: number;
  guides: number;
  schemas: number;
  other: number;
}

/**
 * Token estimation result
 */
export interface TokenEstimate {
  /** Total token count */
  total: number;
  /** Breakdown by section type */
  bySection: TokenBreakdown;
}

/**
 * File count breakdown
 */
export interface FileBreakdown {
  package: number;
  member: number;
  guide: number;
  schema: number;
  unknown: number;
}

/**
 * File count result
 */
export interface FileCount {
  /** Total file count */
  total: number;
  /** Count by file type */
  byType: FileBreakdown;
}

/**
 * Complete health check result
 */
export interface HealthResult {
  /** Path that was checked */
  path: string;
  /** Health score */
  score: Score;
  /** All issues found */
  issues: Issue[];
  /** Token estimate */
  tokens: TokenEstimate;
  /** File counts */
  files: FileCount;
}

/**
 * Options for the health command
 */
export interface HealthOptions {
  /** Show all issues including info */
  verbose?: boolean;
  /** Show only errors */
  errorsOnly?: boolean;
  /** Show errors and warnings (default) */
  warnings?: boolean;
  /** Output as JSON */
  json?: boolean;
  /** Auto-fix simple issues */
  fix?: boolean;
}
