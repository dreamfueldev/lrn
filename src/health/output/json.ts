/**
 * JSON Output Formatter
 *
 * Formats health results as JSON.
 */

import type { HealthResult, HealthOptions } from "../types.js";

/**
 * Format health result as JSON string
 */
export function formatJsonOutput(
  result: HealthResult,
  _options: HealthOptions = {}
): string {
  // Create output object matching the PDR specification
  const output = {
    path: result.path,
    score: {
      overall: result.score.overall,
      categories: {
        structure: result.score.categories.structure,
        content: result.score.categories.content,
        format: result.score.categories.format,
        references: result.score.categories.reference,
      },
    },
    issues: result.issues.map((issue) => ({
      checkId: issue.checkId,
      severity: issue.severity,
      file: issue.file,
      line: issue.line,
      message: issue.message,
      suggestion: issue.suggestion,
    })),
    tokens: {
      total: result.tokens.total,
      bySection: {
        summaries: result.tokens.bySection.summaries,
        descriptions: result.tokens.bySection.descriptions,
        parameters: result.tokens.bySection.parameters,
        examples: result.tokens.bySection.examples,
        guides: result.tokens.bySection.guides,
        schemas: result.tokens.bySection.schemas,
        other: result.tokens.bySection.other,
      },
    },
    files: {
      total: result.files.total,
      byType: {
        package: result.files.byType.package,
        member: result.files.byType.member,
        guide: result.files.byType.guide,
        schema: result.files.byType.schema,
      },
    },
  };

  return JSON.stringify(output, null, 2);
}
