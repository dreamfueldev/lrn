/**
 * Scoring Module
 *
 * Calculates health scores from issues.
 */

import type { Issue, Score, CategoryScores, Severity, CheckCategory } from "./types.js";

/**
 * Deduction points by severity
 */
const SEVERITY_DEDUCTIONS: Record<Severity, number> = {
  error: 10,
  warning: 2,
  info: 0.5,
};

/**
 * Calculate overall score from issues
 *
 * Starts at 100 and deducts points based on severity:
 * - Error: -10 points
 * - Warning: -2 points
 * - Info: -0.5 points
 *
 * Score is clamped to 0-100 range.
 */
export function calculateOverallScore(issues: Issue[]): number {
  let score = 100;

  for (const issue of issues) {
    score -= SEVERITY_DEDUCTIONS[issue.severity];
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Calculate score for a specific category
 *
 * Uses the same deduction logic but only for issues in that category.
 */
export function calculateCategoryScore(
  issues: Issue[],
  category: CheckCategory
): number {
  const categoryIssues = issues.filter((i) => i.category === category);
  return calculateOverallScore(categoryIssues);
}

/**
 * Calculate all category scores
 */
export function calculateCategoryScores(issues: Issue[]): CategoryScores {
  return {
    structure: calculateCategoryScore(issues, "structure"),
    content: calculateCategoryScore(issues, "content"),
    format: calculateCategoryScore(issues, "format"),
    reference: calculateCategoryScore(issues, "reference"),
  };
}

/**
 * Calculate complete score
 */
export function calculateScore(issues: Issue[]): Score {
  return {
    overall: calculateOverallScore(issues),
    categories: calculateCategoryScores(issues),
  };
}

/**
 * Get issue counts by severity
 */
export function countIssuesBySeverity(
  issues: Issue[]
): Record<Severity, number> {
  const counts: Record<Severity, number> = {
    error: 0,
    warning: 0,
    info: 0,
  };

  for (const issue of issues) {
    counts[issue.severity]++;
  }

  return counts;
}
