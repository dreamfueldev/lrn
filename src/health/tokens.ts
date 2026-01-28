/**
 * Token Estimation Module
 *
 * Estimates LLM token counts using character approximation.
 */

import type { FileContext, TokenEstimate, TokenBreakdown } from "./types.js";
import {
  extractFirstBlockquote,
  extractIntro,
  extractSection,
  extractAllCodeBlocks,
  tokensToMarkdown,
} from "../parse/markdown.js";

/**
 * Characters per token (approximation for English text)
 *
 * Based on typical tokenizer behavior where ~4 chars = 1 token.
 */
const CHARS_PER_TOKEN = 4;

/**
 * Estimate tokens from a string
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Estimate tokens for a single file with breakdown by section type
 */
export function estimateFileTokens(file: FileContext): TokenBreakdown {
  const breakdown: TokenBreakdown = {
    summaries: 0,
    descriptions: 0,
    parameters: 0,
    examples: 0,
    guides: 0,
    schemas: 0,
    other: 0,
  };

  if (!file.tokens) {
    // If we can't parse, estimate everything as "other"
    breakdown.other = estimateTokens(file.content);
    return breakdown;
  }

  // Track what content we've accounted for to avoid double-counting
  let accountedTokens = 0;
  const totalTokens = estimateTokens(file.content);

  // Summary (first blockquote)
  const summary = extractFirstBlockquote(file.tokens);
  if (summary) {
    breakdown.summaries = estimateTokens(summary);
    accountedTokens += breakdown.summaries;
  }

  // Description (intro text)
  const description = extractIntro(file.tokens);
  if (description) {
    breakdown.descriptions = estimateTokens(description);
    accountedTokens += breakdown.descriptions;
  }

  // Parameters section
  const paramsSection = extractSection(file.tokens, "Parameters");
  if (paramsSection.length > 0) {
    const paramsMd = tokensToMarkdown(paramsSection);
    breakdown.parameters = estimateTokens(paramsMd);
    accountedTokens += breakdown.parameters;
  }

  // Examples section
  const examplesSection = extractSection(file.tokens, "Examples");
  if (examplesSection.length > 0) {
    const examplesMd = tokensToMarkdown(examplesSection);
    breakdown.examples = estimateTokens(examplesMd);
    accountedTokens += breakdown.examples;
  }

  // Guides (entire file if it's a guide)
  if (file.type === "guide") {
    breakdown.guides = totalTokens;
    // Reset everything else for guides to avoid double-counting
    breakdown.summaries = 0;
    breakdown.descriptions = 0;
    breakdown.parameters = 0;
    breakdown.examples = 0;
    breakdown.other = 0;
    return breakdown;
  }

  // Schemas (entire file if it's a schema)
  if (file.type === "schema") {
    breakdown.schemas = totalTokens;
    // Reset everything else for schemas to avoid double-counting
    breakdown.summaries = 0;
    breakdown.descriptions = 0;
    breakdown.parameters = 0;
    breakdown.examples = 0;
    breakdown.other = 0;
    return breakdown;
  }

  // Everything else not accounted for
  breakdown.other = Math.max(0, totalTokens - accountedTokens);

  return breakdown;
}

/**
 * Estimate tokens for all files
 */
export function estimateTotalTokens(files: FileContext[]): TokenEstimate {
  const breakdown: TokenBreakdown = {
    summaries: 0,
    descriptions: 0,
    parameters: 0,
    examples: 0,
    guides: 0,
    schemas: 0,
    other: 0,
  };

  for (const file of files) {
    const fileBreakdown = estimateFileTokens(file);

    breakdown.summaries += fileBreakdown.summaries;
    breakdown.descriptions += fileBreakdown.descriptions;
    breakdown.parameters += fileBreakdown.parameters;
    breakdown.examples += fileBreakdown.examples;
    breakdown.guides += fileBreakdown.guides;
    breakdown.schemas += fileBreakdown.schemas;
    breakdown.other += fileBreakdown.other;
  }

  const total =
    breakdown.summaries +
    breakdown.descriptions +
    breakdown.parameters +
    breakdown.examples +
    breakdown.guides +
    breakdown.schemas +
    breakdown.other;

  return {
    total,
    bySection: breakdown,
  };
}
