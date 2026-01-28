/**
 * Text Output Formatter
 *
 * Formats health results for terminal display.
 */

import type { HealthResult, Issue, Severity, HealthOptions } from "../types.js";
import { countIssuesBySeverity } from "../scoring.js";

/**
 * Score indicator emoji/symbols
 */
function scoreIndicator(score: number): string {
  if (score >= 90) return "✓";
  if (score >= 70) return "⚠";
  return "✗";
}

/**
 * Format a single issue for display
 */
function formatIssue(issue: Issue): string {
  const location = issue.line ? `${issue.file}:${issue.line}` : issue.file;
  return `  ${location} [${issue.checkId}] ${issue.message}`;
}

/**
 * Format token count with comma separators
 */
function formatNumber(n: number): string {
  return n.toLocaleString();
}

/**
 * Format health result as text
 */
export function formatTextOutput(
  result: HealthResult,
  options: HealthOptions = {}
): string {
  const lines: string[] = [];
  const counts = countIssuesBySeverity(result.issues);

  // Header
  lines.push(`lrn health: ${result.path}`);
  lines.push("");

  // Score
  lines.push(`Score: ${result.score.overall}/100`);
  lines.push("");

  // Category breakdown
  const cats = result.score.categories;
  lines.push(
    `  Structure:  ${cats.structure.toString().padStart(3)}/100  ${scoreIndicator(cats.structure)}`
  );
  lines.push(
    `  Content:    ${cats.content.toString().padStart(3)}/100  ${scoreIndicator(cats.content)}`
  );
  lines.push(
    `  Format:     ${cats.format.toString().padStart(3)}/100  ${scoreIndicator(cats.format)}`
  );
  lines.push(
    `  References: ${cats.reference.toString().padStart(3)}/100  ${scoreIndicator(cats.reference)}`
  );
  lines.push("");

  // Issue summary
  lines.push(
    `Issues: ${counts.error} errors, ${counts.warning} warnings, ${counts.info} info`
  );
  lines.push("");

  // Filter issues based on options
  const showErrors = true; // Always show errors
  const showWarnings = !options.errorsOnly;
  const showInfo = options.verbose;

  // Group issues by severity
  const errors = result.issues.filter((i) => i.severity === "error");
  const warnings = result.issues.filter((i) => i.severity === "warning");
  const infos = result.issues.filter((i) => i.severity === "info");

  // Show errors
  if (showErrors && errors.length > 0) {
    lines.push("Errors:");
    for (const issue of errors) {
      lines.push(formatIssue(issue));
    }
    lines.push("");
  }

  // Show warnings
  if (showWarnings && warnings.length > 0) {
    lines.push("Warnings:");
    for (const issue of warnings) {
      lines.push(formatIssue(issue));
    }
    lines.push("");
  }

  // Show info
  if (showInfo && infos.length > 0) {
    lines.push("Info:");
    for (const issue of infos) {
      lines.push(formatIssue(issue));
    }
    lines.push("");
  }

  // Token estimate
  lines.push(`Token estimate: ${formatNumber(result.tokens.total)} tokens`);
  const ts = result.tokens.bySection;
  if (ts.summaries > 0) {
    lines.push(`  Summaries:     ${formatNumber(ts.summaries).padStart(8)}`);
  }
  if (ts.descriptions > 0) {
    lines.push(`  Descriptions:  ${formatNumber(ts.descriptions).padStart(8)}`);
  }
  if (ts.parameters > 0) {
    lines.push(`  Parameters:    ${formatNumber(ts.parameters).padStart(8)}`);
  }
  if (ts.examples > 0) {
    lines.push(`  Examples:      ${formatNumber(ts.examples).padStart(8)}`);
  }
  if (ts.guides > 0) {
    lines.push(`  Guides:        ${formatNumber(ts.guides).padStart(8)}`);
  }
  if (ts.schemas > 0) {
    lines.push(`  Schemas:       ${formatNumber(ts.schemas).padStart(8)}`);
  }
  if (ts.other > 0) {
    lines.push(`  Other:         ${formatNumber(ts.other).padStart(8)}`);
  }

  // File breakdown
  lines.push("");
  lines.push(`Files: ${result.files.total} total`);
  const fb = result.files.byType;
  if (fb.package > 0) lines.push(`  Package:  ${fb.package}`);
  if (fb.member > 0) lines.push(`  Members:  ${fb.member}`);
  if (fb.guide > 0) lines.push(`  Guides:   ${fb.guide}`);
  if (fb.schema > 0) lines.push(`  Schemas:  ${fb.schema}`);
  if (fb.unknown > 0) lines.push(`  Unknown:  ${fb.unknown}`);

  return lines.join("\n");
}
