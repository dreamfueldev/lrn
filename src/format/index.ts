/**
 * Output Formatting
 *
 * Handles formatting data for different output modes.
 */

import type { Package, Member, Guide, Section, Schema } from "../schema/index.js";
import type { ResolvedConfig } from "../config.js";
import type { ParsedArgs } from "../args.js";
import { formatText } from "./text.js";
import { formatJson } from "./json.js";
import { formatMarkdown } from "./markdown.js";
import { formatSummary } from "./summary.js";

export type OutputFormat = "text" | "json" | "markdown" | "summary";

/**
 * Data types that can be formatted
 */
export type FormattableData =
  | Package
  | Package[]
  | Member
  | Member[]
  | Guide
  | Guide[]
  | Section
  | Schema
  | SearchResults
  | TagList;

export interface SearchResult {
  package: string;
  type: "member" | "guide";
  path: string;
  name: string;
  summary?: string;
  score: number;
  tags?: string[];
  kind?: string;
  deprecated?: boolean;
}

export interface SearchResults {
  kind: "search-results";
  query: string;
  results: SearchResult[];
}

export interface TagList {
  kind: "tag-list";
  tags: Array<{ name: string; count: number }>;
}

/**
 * Formatting options
 */
export interface FormatOptions {
  /** Output format */
  format: OutputFormat;
  /** Show full details (override progressive disclosure) */
  full?: boolean;
  /** Package name (for context in output) */
  packageName?: string;
  /** Current path (for context in output) */
  path?: string;
  /** Show signatures instead of summaries in list view */
  signatures?: boolean;
  /** Extract a specific part of a member */
  extraction?: "signature" | "examples" | "parameters";
}

/**
 * Determine the output format based on args and config
 */
export function getOutputFormat(args: ParsedArgs, config: ResolvedConfig): OutputFormat {
  // Explicit --format flag takes priority
  if (args.options.format) {
    const format = args.options.format;
    if (["text", "json", "markdown", "summary"].includes(format)) {
      return format as OutputFormat;
    }
  }

  // --json shorthand
  if (args.flags.json) {
    return "json";
  }

  // --summary shorthand
  if (args.flags.summary) {
    return "summary";
  }

  // Use config default
  return config.defaultFormat;
}

/**
 * Format data for output
 */
export function format(data: FormattableData, options: FormatOptions): string {
  switch (options.format) {
    case "json":
      return formatJson(data, options);
    case "markdown":
      return formatMarkdown(data, options);
    case "summary":
      return formatSummary(data, options);
    case "text":
    default:
      return formatText(data, options);
  }
}

/**
 * Print formatted data to stdout
 */
export function print(data: FormattableData, options: FormatOptions): void {
  console.log(format(data, options));
}

// Re-export individual formatters for direct use
export { formatText } from "./text.js";
export { formatJson } from "./json.js";
export { formatMarkdown } from "./markdown.js";
export { formatSummary } from "./summary.js";
